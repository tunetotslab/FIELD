import { FieldAccount } from "./components/FieldAccount";
import { LibrarySyncControl, libraryCopy } from "./components/LibrarySync";
import { TelegramLink } from "./components/TelegramLink";
import { isAuthenticated, currentUserId } from "./auth/session";
import { NativeAccount } from "./components/NativeAccount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EffectId,
  RecorderState,
  Screen,
  SoundDraft,
  SoundLocation,
  SoundRecord,
  Visibility,
} from "./types";
import { FieldRecorder } from "./audio/recorder";
import { analyze, effectLabel, renderDraft } from "./audio/processing";
import { changesAudio, patchDraft } from "./audio/draft";
import {
  prepareWavFile,
  runFileAction,
  fileActionErrorMessage,
} from "./audio/fileActions";
import { newId } from "./id";
import { formatTime } from "./audio/utils";
import { PlaybackManager } from "./audio/player";
import { soundsDb } from "./storage/db";
import { hasResolvableCity, publicationStart } from "./storage/normalize";
import { subscribeForeground } from "./lifecycle";
import { isAuthenticationError, publicationErrorMessage } from "./world";
import { telegram } from "./telegram";
import { Dialog } from "./components/Dialog";
import { Donate } from "./components/Donate";
import {
  uploadWorld,
  unpublishWorld,
  retryPendingWorld,
} from "./storage/publication";
import { WorldMap } from "./components/WorldMap";
import {
  fieldGroups,
  joinFieldGroup,
  publishGroupSound,
  retryGroupDelivery,
  type FieldGroup,
} from "./groups";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "./theme";
import { isNativeApp } from "./native/runtime";
import { subscribeNativeLifecycle } from "./native/lifecycle";
import { AppNavigationProvider, Shell } from "./components/Shell";
import { FieldWordmark, Miley } from "./components/Brand";
import { Waveform } from "./components/Waveform";
import { ErrorPanel } from "./components/ErrorPanel";
import { EmailContact } from "./components/EmailContact";
import { FxArtwork } from "./components/FieldArtwork";
import { Daily } from "./components/Daily";
import { tasks, type Task } from "./data/tasks";
import { taskImages } from "./data/taskImages";
import {
  createTaskSelector,
  dailyTaskIds,
  createImageVariantSelector,
  TASK_ROTATION_MODE,
  localDate,
} from "./data/taskRotation";
import { emojiCategories, searchEmoji, type EmojiCategory } from "./data/emoji";
import { useI18n, type Locale } from "./i18n";
import {
  COMMUNITY_PUBLISHING_AVAILABLE,
  EXTERNAL_LINKS,
  GROUP_PUBLISHING_AVAILABLE,
} from "./config";
import { isWorldRestrictedLocation, searchCities } from "./data/geo";
import { settingsContent, type SettingsArticle } from "./data/settingsContent";

const STYLES = [
  { id: "grotesk", label: "FIELD GROTESK" },
  { id: "bubble", label: "BUBBLE GUM" },
  { id: "gothic", label: "GOTHIC" },
  { id: "times", label: "Times New Roman" },
  { id: "italic", label: "ITALIC" },
  { id: "experimental", label: "EXPERIMENTAL" },
];
const EFFECTS: EffectId[] = [
  "original",
  "echo",
  "resonator",
  "tapeStop",
  "chorus",
  "flanger",
  "lofi",
  "glitch",
  "reverse",
  "pitch",
  "space",
  "destroy",
];
const player = new PlaybackManager();
const selectTask = createTaskSelector(dailyTaskIds(tasks), {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});

function newDraft(
  blob: Blob,
  duration: number,
  waveform: number[],
): SoundDraft {
  return {
    id: newId(),
    originalBlob: blob,
    duration,
    trimStart: 0,
    trimEnd: duration,
    fadeIn: false,
    fadeOut: false,
    loop: false,
    effect: "original",
    effectMix: 70,
    pitchSemitones: 7,
    echoDelayMs: 340,
    emojis: [],
    visibility: "private",
    createdAt: Date.now(),
    waveform,
  };
}

const selectImageVariant = createImageVariantSelector({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});

export default function App() {
  const { t } = useI18n();
  const [activeTask, setActiveTask] = useState<Task & { imageSrc: string }>();
  const dailyDate = useRef("");
  const refreshDaily = useCallback(() => {
    const date = new Date();
    const day = localDate(date);
    if (dailyDate.current === day) return;
    dailyDate.current = day;
    const id = selectTask(TASK_ROTATION_MODE, date);
    const task = tasks.find((task) => task.id === id)!;
    const images = taskImages[task.imageId];
    setActiveTask({
      ...task,
      imageSrc:
        images[
          selectImageVariant(
            task.imageId,
            images.length,
            TASK_ROTATION_MODE,
            date,
          )
        ],
    });
  }, []);
  const [screen, setScreen] = useState<Screen>("home");
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    if (screen !== "daily") return;
    refreshDaily();
    return subscribeForeground(refreshDaily, 30000);
  }, [screen, refreshDaily]);
  const [draft, setDraft] = useState<SoundDraft>();
  const [records, setRecords] = useState<SoundRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string>();
  const [mapCity, setMapCity] = useState<string>();
  const [savePhase, setSavePhase] = useState<
    "preparing" | "uploading" | "groupUpload"
  >("preparing");
  const settingsReturn = useRef<Screen>("home");
  const workflowReturn = useRef<Screen | undefined>(undefined);
  const pendingChallenge = useRef<string | undefined>(undefined);
  const reusedRecord = useRef<SoundRecord | undefined>(undefined);

  const loadLibrary = useCallback(async () => {
    try {
      const owner = currentUserId();
      const rows = (await soundsDb.getAll()).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      if (owner === currentUserId()) setRecords(rows);
    } catch (error) {
      setNotice(publicationErrorMessage(error, t));
    }
  }, [t]);
  useEffect(() => {
    const cleanup = telegram.init();
    void loadLibrary();
    let active = true;
    let nativeCleanup: (() => void) | undefined;
    const background = () => {
      player.stop();
      setPlayingId(undefined);
    };
    window.addEventListener("field-app-background", background);
    void subscribeNativeLifecycle()
      .then((dispose) => {
        if (active) nativeCleanup = dispose;
        else dispose();
      })
      .catch(() => {});
    return () => {
      active = false;
      nativeCleanup?.();
      window.removeEventListener("field-app-background", background);
      cleanup?.();
      player.stop();
    };
  }, [loadLibrary]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      void loadLibrary();
    };
    const sync = () => {
      if (screenRef.current !== "record" && screenRef.current !== "fx")
        void soundsDb.sync();
    };
    const pending = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 700);
    };
    const account = () => {
      player.stop();
      setPlayingId(undefined);
      setRecords([]);
      soundsDb.accountChanged();
      void loadLibrary();
      sync();
    };
    window.addEventListener("field-library-changed", refresh);
    window.addEventListener("field-library-pending", pending);
    window.addEventListener("field-auth-changed", account);
    window.addEventListener("online", sync);
    const foreground = subscribeForeground(sync, 30000);
    sync();
    return () => {
      clearTimeout(timer);
      foreground();
      soundsDb.accountChanged();
      window.removeEventListener("field-library-changed", refresh);
      window.removeEventListener("field-library-pending", pending);
      window.removeEventListener("field-auth-changed", account);
      window.removeEventListener("online", sync);
    };
  }, [loadLibrary]);
  useEffect(() => {
    if (!COMMUNITY_PUBLISHING_AVAILABLE) return;
    let active = true;
    const retry = () => {
      void retryPendingWorld().then(() => {
        if (active) void loadLibrary();
      });
    };
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("field-auth-changed", retry);
    return () => {
      active = false;
      window.removeEventListener("online", retry);
      window.removeEventListener("field-auth-changed", retry);
    };
  }, [loadLibrary]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    if (screen !== "library") return;
    void loadLibrary();
    void soundsDb.sync();
    return subscribeForeground(() => {
      void loadLibrary();
    });
  }, [screen, loadLibrary]);
  const go = (next: Screen) => {
    if (next === "daily") {
      refreshDaily();
    }
    if (
      next === "settings" &&
      ![
        "settings",
        "donate",
        "randomDonate",
        "links",
        "privacy",
        "microphone",
        "about",
        "help",
      ].includes(screen)
    )
      settingsReturn.current = screen;
    if (["library", "daily", "map"].includes(next)) {
      const processScreens: Screen[] = [
        "edit",
        "fx",
        "emoji",
        "title",
        "style",
        "location",
        "visibility",
        "ready",
      ];
      if (processScreens.includes(screen)) workflowReturn.current = screen;
      else if (
        [
          "settings",
          "donate",
          "randomDonate",
          "links",
          "privacy",
          "microphone",
          "about",
          "help",
        ].includes(screen) &&
        processScreens.includes(settingsReturn.current)
      )
        workflowReturn.current = settingsReturn.current;
    }
    player.stop();
    setPlayingId(undefined);
    setNotice("");
    setScreen(next);
  };
  const update = (patch: Partial<SoundDraft>) => {
    const newVersion =
      (!!reusedRecord.current ||
        records.some((record) => record.id === draft?.id)) &&
      changesAudio(patch);
    if (newVersion) reusedRecord.current = undefined;
    setDraft((current) =>
      current
        ? {
            ...patchDraft(current, patch),
            ...(newVersion
              ? {
                  id: newId(),
                  createdAt: Date.now(),
                  visibility: "private" as const,
                }
              : {}),
          }
        : current,
    );
  };
  const cacheReady = useCallback(
    (
      source: SoundDraft,
      rendered: { blob: Blob; duration: number; waveform: number[] },
    ) => {
      setDraft((current) =>
        current === source
          ? {
              ...current,
              processedBlob: rendered.blob,
              processedDuration: rendered.duration,
              processedWaveform: rendered.waveform,
            }
          : current,
      );
    },
    [],
  );

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setSavePhase("preparing");
    setNotice("");
    try {
      const previous = (await soundsDb.getAll()).find(
        (record) => record.id === draft.id,
      );
      const rendered = reusedRecord.current
        ? {
            blob: reusedRecord.current.audioBlob,
            duration: reusedRecord.current.duration,
            waveform: reusedRecord.current.waveform,
          }
        : draft.processedBlob
          ? {
              blob: draft.processedBlob,
              duration: draft.processedDuration ?? draft.duration,
              waveform: draft.processedWaveform ?? draft.waveform,
            }
          : await renderDraft(draft);
      const record: SoundRecord = {
        ...previous,
        ...reusedRecord.current,
        // Metadata-only publication must not turn a legacy render into a claimed
        // pre-FX original or invent editable settings that were never saved.
        originalBlob: reusedRecord.current
          ? reusedRecord.current.originalBlob
          : draft.originalBlob,
        editState: reusedRecord.current
          ? reusedRecord.current.editState
          : (({
              originalBlob: _original,
              processedBlob: _processed,
              processedDuration: _duration,
              processedWaveform: _peaks,
              ...state
            }) => state)(draft),
        id: draft.id,
        title: draft.title?.trim() || "Untitled Sound",
        emojis: draft.emojis,
        styleId: draft.styleId || "grotesk",
        duration: rendered.duration,
        createdAt: draft.createdAt,
        favorite: previous?.favorite || reusedRecord.current?.favorite || false,
        location: draft.location,
        visibility: "private",
        groupId: draft.groupId,
        groupName: draft.groupName,
        effect: reusedRecord.current?.effect || draft.effect,
        effectChain: reusedRecord.current?.effectChain || draft.effectChain,
        effectMix: reusedRecord.current?.effectMix ?? draft.effectMix,
        echoDelayMs: reusedRecord.current?.echoDelayMs ?? draft.echoDelayMs,
        dailyChallenge:
          reusedRecord.current?.dailyChallenge || draft.dailyChallenge,
        audioBlob: rendered.blob,
        waveform: rendered.waveform,
      };
      await soundsDb.save(record);
      // Export/preview stay usable even when the destination rejects upload.
      setDraft({
        ...draft,
        processedBlob: rendered.blob,
        processedWaveform: rendered.waveform,
        processedDuration: rendered.duration,
      });
      if (draft.visibility === "world" && COMMUNITY_PUBLISHING_AVAILABLE) {
        setSavePhase("uploading");
        try {
          const saved = await uploadWorld(record);
          setMapCity(saved.location?.placeId);
          if (saved.worldPublication?.state !== "published") {
            await loadLibrary();
            setNotice(t("offlinePending"));
            return;
          }
        } catch (error) {
          await loadLibrary();
          setNotice(publicationErrorMessage(error, t));
          return;
        }
      }
      if (
        draft.visibility === "group" &&
        GROUP_PUBLISHING_AVAILABLE &&
        draft.groupId
      ) {
        setSavePhase("groupUpload");
        record.groupPublication = {
          state: "pending",
          groupId: draft.groupId,
          groupName: draft.groupName,
        };
        await soundsDb.save(record);
        try {
          const published = await publishGroupSound(draft.groupId, record);
          await soundsDb.save({
            ...record,
            groupPublication: {
              ...record.groupPublication,
              state:
                published.telegramDeliveryState === "delivered"
                  ? "published"
                  : "failed",
              serverId: published.id,
            },
          });
          if (published.telegramDeliveryState !== "delivered") {
            await loadLibrary();
            setNotice(
              published.telegramDeliveryState === "unconnected"
                ? t("savedGroupUnconnected")
                : t("savedGroupDeliveryFailed"),
            );
            return;
          }
        } catch (error) {
          await soundsDb.save({
            ...record,
            groupPublication: { ...record.groupPublication, state: "failed" },
          });
          await loadLibrary();
          setNotice(publicationErrorMessage(error, t));
          return;
        }
      }
      await loadLibrary();
      telegram.success();
      setDraft({
        ...draft,
        processedBlob: rendered.blob,
        processedWaveform: rendered.waveform,
        processedDuration: rendered.duration,
      });
      setNotice(
        draft.visibility === "world" && !COMMUNITY_PUBLISHING_AVAILABLE
          ? t("savedLocalOnly")
          : draft.visibility === "world"
            ? t("savedWorld")
            : draft.visibility === "group"
              ? t("savedGroup")
              : t("savedPrivate"),
      );
    } catch (error) {
      setNotice(publicationErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const content = (() => {
    switch (screen) {
      case "home":
        return <Home go={go} />;
      case "record":
        return (
          <RecordScreen
            onDone={(value) => {
              reusedRecord.current = undefined;
              setDraft({ ...value, dailyChallenge: pendingChallenge.current });
              pendingChallenge.current = undefined;
              go("edit");
            }}
            onCancel={() => go("home")}
          />
        );
      case "edit":
        return (
          draft && (
            <EditScreen
              draft={draft}
              update={update}
              next={() => go("fx")}
              back={() => go("record")}
              playing={playingId === "draft"}
              setPlaying={(value) => setPlayingId(value ? "draft" : undefined)}
            />
          )
        );
      case "fx":
        return (
          draft && (
            <FxScreen
              draft={draft}
              update={update}
              next={() => go("emoji")}
              back={() => go("edit")}
              setPlaying={(value) => setPlayingId(value ? "draft" : undefined)}
            />
          )
        );
      case "emoji":
        return (
          draft && (
            <EmojiScreen
              draft={draft}
              update={update}
              next={() => go("title")}
              back={() => go("fx")}
            />
          )
        );
      case "title":
        return (
          draft && (
            <TitleScreen
              draft={draft}
              update={update}
              next={() => go("style")}
              back={() => go("emoji")}
            />
          )
        );
      case "style":
        return (
          draft && (
            <StyleScreen
              draft={draft}
              update={update}
              next={() => go("location")}
              back={() => go("title")}
            />
          )
        );
      case "location":
        return (
          draft && (
            <LocationScreen
              draft={draft}
              update={update}
              next={() => go("visibility")}
              back={() => go("style")}
            />
          )
        );
      case "visibility":
        return (
          draft && (
            <VisibilityScreen
              draft={draft}
              update={update}
              next={() => go("ready")}
              back={() => go("location")}
            />
          )
        );
      case "ready":
        return (
          draft && (
            <ReadyScreen
              draft={draft}
              busy={busy}
              phase={savePhase}
              seeMap={() => go("map")}
              done={() => go("library")}
              notice={notice}
              save={save}
              prepared={cacheReady}
              fresh={() => {
                reusedRecord.current = undefined;
                setDraft(undefined);
                go("home");
              }}
              back={() => go("visibility")}
              playing={playingId === "draft"}
              setPlaying={(value) => setPlayingId(value ? "draft" : undefined)}
            />
          )
        );
      case "library":
        return (
          <Library
            editRecord={async (record, destination) => {
              player.stop();
              if (destination) {
                reusedRecord.current = record;
                setDraft({
                  ...newDraft(
                    record.audioBlob,
                    record.duration,
                    record.waveform,
                  ),
                  ...record.editState,
                  id: record.id,
                  originalBlob: record.originalBlob || record.audioBlob,
                  title: record.title,
                  emojis: record.emojis,
                  styleId: record.styleId,
                  location: record.location,
                  createdAt: record.createdAt,
                  processedBlob: record.audioBlob,
                  processedDuration: record.duration,
                  processedWaveform: record.waveform,
                  visibility: destination,
                });
                go(publicationStart(record, destination));
              } else {
                reusedRecord.current = undefined;
                const base = record.originalBlob || record.audioBlob;
                const analyzed = await analyze(base);
                setDraft({
                  ...newDraft(base, analyzed.duration, analyzed.waveform),
                  ...record.editState,
                  title: record.title,
                  emojis: record.emojis,
                  location: record.location,
                  styleId: record.styleId,
                  id: newId(),
                  originalBlob: base,
                  visibility: "private",
                  createdAt: Date.now(),
                });
                go("edit");
                setNotice(
                  t(record.originalBlob ? "editVersion" : "legacyEdit"),
                );
              }
            }}
            seeMap={(record) => {
              setMapCity(record.location?.placeId);
              go("map");
            }}
            records={records}
            reload={loadLibrary}
            go={go}
            playingId={playingId}
            setPlayingId={setPlayingId}
            setNotice={setNotice}
            notice={notice}
            back={() =>
              go(
                draft && workflowReturn.current
                  ? workflowReturn.current
                  : "home",
              )
            }
          />
        );
      case "daily":
        return (
          <Daily
            task={activeTask!}
            go={(next) => {
              if (next === "record") pendingChallenge.current = activeTask!.id;
              go(next);
            }}
            back={() =>
              go(
                draft && workflowReturn.current
                  ? workflowReturn.current
                  : "home",
              )
            }
          />
        );
      case "map":
        return (
          <WorldMap
            focusCity={mapCity}
            player={player}
            back={() =>
              go(
                draft && workflowReturn.current
                  ? workflowReturn.current
                  : "home",
              )
            }
          />
        );
      case "settings":
        return <Settings go={go} back={() => go(settingsReturn.current)} />;
      case "donate":
        return <Donate go={go} />;
      case "randomDonate":
        return <Donate key="random" go={go} random />;
      case "links":
        return <Links go={go} />;
      case "privacy":
      case "about":
      case "help":
        return <InformationScreen kind={screen} go={go} />;
      case "microphone":
        return <MicrophoneScreen go={go} />;
      default:
        return null;
    }
  })();
  return (
    <div className="viewport">
      <AppNavigationProvider screen={screen} go={go}>
        {content}
      </AppNavigationProvider>
    </div>
  );
}

function Home({ go }: { go: (s: Screen) => void }) {
  const { t } = useI18n();
  return (
    <Shell variant="home">
      <FieldWordmark />
      <div className="home-illustration">
        <Miley state="record" />
        <p className="hand home-caption">{t("soundsEverywhere")}</p>
      </div>
      <div className="home-record-zone">
        <button
          className="record-button"
          onClick={() => {
            telegram.impact("heavy");
            go("record");
          }}
          aria-label={t("record")}
        >
          <span />
        </button>
        <strong>{t("record")}</strong>
      </div>
    </Shell>
  );
}

function RecordScreen({
  onDone,
  onCancel,
}: {
  onDone: (draft: SoundDraft) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<RecorderState>("idle");
  const [time, setTime] = useState(0);
  const [error, setError] = useState("");
  const [captured, setCaptured] = useState<SoundDraft>();
  const [playing, setPlaying] = useState(false);
  const recorder = useRef<FieldRecorder | undefined>(undefined);
  const liveCanvas = useRef<HTMLCanvasElement | null>(null);
  const captureGeneration = useRef(0);
  const rawCapture = useRef<{ blob: Blob; duration: number } | undefined>(
    undefined,
  );
  const decodeCapture = async (
    blob: Blob,
    duration: number,
    generation: number,
  ) => {
    try {
      const result = await analyze(blob);
      if (generation !== captureGeneration.current) return;
      const value = newDraft(
        blob,
        result.duration || duration,
        result.waveform,
      );
      setCaptured(value);
      setTime(value.duration);
      setState("ready");
    } catch {
      if (generation !== captureGeneration.current) return;
      setState("error");
      setError(t("decodeRetry"));
    }
  };
  const start = useCallback(() => {
    const generation = ++captureGeneration.current;
    rawCapture.current = undefined;
    recorder.current?.discard();
    setTime(0);
    setCaptured(undefined);
    player.stop();
    setPlaying(false);
    setError("");
    recorder.current = new FieldRecorder({
      onState: (next, message) => {
        if (generation !== captureGeneration.current) return;
        setState(next);
        if (message) setError(message);
      },
      onTime: (seconds) => {
        if (generation === captureGeneration.current) setTime(seconds);
      },
      onComplete: (blob, duration) => {
        if (generation !== captureGeneration.current) return;
        rawCapture.current = { blob, duration };
        void decodeCapture(blob, duration, generation);
      },
    });
    recorder.current.attachVisualizer(liveCanvas.current);
    void recorder.current.start();
  }, []);
  useEffect(() => {
    start();
    return () => {
      captureGeneration.current++;
      recorder.current?.discard();
      player.stop();
    };
  }, [start]);
  const playback = () => {
    if (!captured) return;
    if (playing) {
      player.pause();
      setPlaying(false);
    } else player.play("record-review", captured.originalBlob, setPlaying);
  };
  return (
    <Shell
      title={t("recording")}
      back={() => {
        recorder.current?.discard();
        onCancel();
      }}
    >
      {state === "error" ? (
        <ErrorPanel
          message={error}
          retry={() => {
            const capture = rawCapture.current;
            if (capture) {
              setError("");
              setState("processing");
              void decodeCapture(
                capture.blob,
                capture.duration,
                captureGeneration.current,
              );
            } else start();
          }}
        />
      ) : (
        <>
          <div className="timer">{formatTime(time)}</div>
          <div className="record-wave">
            {state === "ready" && captured ? (
              <Waveform peaks={captured.waveform} />
            ) : (
              <canvas
                ref={liveCanvas}
                className="live-waveform"
                aria-label="Live microphone waveform"
              />
            )}
          </div>
          {state === "ready" && captured ? (
            <>
              <div className="playback-review">
                <button onClick={playback}>
                  {playing ? t("pause") : t("play")}
                </button>
                <button
                  onClick={() => {
                    player.restart();
                    setPlaying(true);
                  }}
                >
                  {t("restart")}
                </button>
              </div>
              <button
                className="primary-button"
                onClick={() => onDone(captured)}
              >
                {t("editRecording")}
              </button>
            </>
          ) : (
            <div className="record-controls">
              <button
                className="round-control danger"
                onClick={() => {
                  if (confirm(t("deleteRecording"))) {
                    recorder.current?.discard();
                    onCancel();
                  }
                }}
                aria-label={t("delete")}
              >
                ⌫
              </button>
              <button
                disabled={state !== "recording" && state !== "paused"}
                className={`record-button compact ${state === "recording" ? "recording" : "record-resume"}`}
                onClick={() =>
                  state === "paused"
                    ? recorder.current?.resume()
                    : recorder.current?.pause()
                }
                aria-label={
                  state === "paused" ? "Resume recording" : "Pause recording"
                }
              >
                {state === "paused" ? (
                  <span className="record-resume-label">
                    <i aria-hidden="true" />
                    REC
                  </span>
                ) : (
                  <span>Ⅱ</span>
                )}
              </button>
              <button
                className="round-control"
                disabled={
                  state === "processing" || state === "requesting-permission"
                }
                onClick={() => {
                  telegram.impact("medium");
                  recorder.current?.stop();
                }}
                aria-label="Finish recording"
              >
                ✓
              </button>
            </div>
          )}
          <p className="hand centered">
            {state === "ready"
              ? t("listenBack")
              : state === "requesting-permission"
                ? t("requestingMic")
                : state === "processing"
                  ? t("makingSound")
                  : state === "paused"
                    ? t("paused")
                    : t("goodSounds")}
          </p>
        </>
      )}
    </Shell>
  );
}

function EditScreen({
  draft,
  update,
  next,
  back,
  playing,
  setPlaying,
}: {
  draft: SoundDraft;
  update: (p: Partial<SoundDraft>) => void;
  next: () => void;
  back: () => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const startPct = (draft.trimStart / draft.duration) * 100,
    endPct = (draft.trimEnd / draft.duration) * 100;
  const changeTrim = (patch: Partial<SoundDraft>) => {
    player.stop();
    setPlaying(false);
    update(patch);
  };
  const preview = async () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      const rendered = await renderDraft({
        ...draft,
        effect: "original",
        effectChain: [],
      });
      player.play("draft", rendered.blob, setPlaying, draft.loop);
    }
  };
  return (
    <Shell title={t("edit")} back={back}>
      <div className="trim-editor">
        <Waveform
          peaks={draft.waveform}
          start={startPct / 100}
          end={endPct / 100}
        />
        <input
          aria-label="Trim start"
          className="range start-range"
          type="range"
          min="0"
          max="100"
          value={startPct}
          onChange={(e) =>
            changeTrim({
              trimStart: Math.min(
                (Number(e.target.value) / 100) * draft.duration,
                draft.trimEnd - 0.1,
              ),
            })
          }
        />
        <input
          aria-label="Trim end"
          className="range end-range"
          type="range"
          min="0"
          max="100"
          value={endPct}
          onChange={(e) =>
            changeTrim({
              trimEnd: Math.max(
                (Number(e.target.value) / 100) * draft.duration,
                draft.trimStart + 0.1,
              ),
            })
          }
        />
      </div>
      <div className="trim-times">
        <span>{formatTime(draft.trimStart)}</span>
        <span>{formatTime(draft.trimEnd)}</span>
      </div>
      <div className="trim-playback">
        <button
          onClick={() => {
            player.restart();
            setPlaying(true);
          }}
          aria-label={t("restart")}
        >
          ↺
        </button>
        <button
          className="play-main"
          onClick={() => void preview()}
          aria-label="Preview selection"
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
      </div>
      <div className="edit-tools">
        <button className="selected">
          ✂<span>TRIM</span>
        </button>
        <button
          disabled
          title="Split is prepared for a later non-destructive editor"
        >
          ＋
          <span>
            SPLIT
            <br />
            <small>SOON</small>
          </span>
        </button>
        <button
          className={draft.loop ? "selected" : ""}
          onClick={() => update({ loop: !draft.loop })}
        >
          ↻<span>LOOP</span>
        </button>
        <button
          className={draft.fadeIn || draft.fadeOut ? "selected" : ""}
          onClick={() =>
            update({
              fadeIn: !(draft.fadeIn && draft.fadeOut),
              fadeOut: !(draft.fadeIn && draft.fadeOut),
            })
          }
        >
          ⌁<span>FADE</span>
        </button>
      </div>
      <button className="primary-button" onClick={next}>
        CONTINUE →
      </button>
    </Shell>
  );
}

export function FxScreen({
  draft,
  update,
  next,
  back,
  setPlaying,
}: {
  draft: SoundDraft;
  update: (p: Partial<SoundDraft>) => void;
  next: () => void;
  back: () => void;
  setPlaying: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const sequence = useRef(0);
  const renderController = useRef<AbortController | undefined>(undefined);
  const [rendering, setRendering] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [activeSlot, setActiveSlot] = useState(() =>
    Math.max(
      0,
      draft.effectChain?.findIndex(
        (slot) =>
          slot.effect === draft.effect &&
          slot.mix === draft.effectMix &&
          slot.pitchSemitones === draft.pitchSemitones &&
          slot.echoDelayMs === draft.echoDelayMs,
      ) ?? 0,
    ),
  );
  const chain =
    draft.effectChain ||
    (draft.effect === "original"
      ? []
      : [
          {
            effect: draft.effect,
            mix: draft.effectMix,
            pitchSemitones: draft.pitchSemitones,
            echoDelayMs: draft.echoDelayMs,
          },
        ]);
  const chainPatch = (patch: Partial<SoundDraft>): Partial<SoundDraft> => {
    if (patch.effectChain) return patch;
    if (patch.effect === "original") return { ...patch, effectChain: [] };
    if (!Object.keys(patch).length) return patch;
    const next = chain.slice();
    const index = Math.min(activeSlot, next.length);
    const current = next[index] || {
      effect: "original" as const,
      mix: 70,
      pitchSemitones: 7,
      echoDelayMs: 340,
    };
    next[index] = {
      ...current,
      ...(patch.effect ? { effect: patch.effect } : {}),
      ...(patch.effectMix !== undefined ? { mix: patch.effectMix } : {}),
      ...(patch.pitchSemitones !== undefined
        ? { pitchSemitones: patch.pitchSemitones }
        : {}),
      ...(patch.echoDelayMs !== undefined
        ? { echoDelayMs: patch.echoDelayMs }
        : {}),
    };
    return { ...patch, effectChain: next.slice(0, 3) };
  };
  useEffect(
    () => () => {
      sequence.current++;
      renderController.current?.abort();
      player.stop();
    },
    [],
  );
  const preview = async (patch: Partial<SoundDraft>, dry = false) => {
    patch = chainPatch(patch);
    const token = ++sequence.current;
    renderController.current?.abort();
    const controller = new AbortController();
    renderController.current = controller;
    const nextDraft = {
      ...draft,
      ...patch,
      ...(dry ? { effect: "original" as const, effectChain: [] } : {}),
    };
    if (!dry) update({ ...patch, processedBlob: undefined });
    setRendering(true);
    setPreviewError("");
    player.stop();
    setPreviewPlaying(false);
    try {
      const rendered = await renderDraft(nextDraft, controller.signal);
      if (token !== sequence.current) return;
      player.play(
        "draft",
        rendered.blob,
        (value) => {
          setPreviewPlaying(value);
          setPlaying(value);
        },
        draft.loop,
        true,
      );
    } catch (error) {
      if (token === sequence.current)
        setPreviewError(
          error instanceof Error
            ? error.message
            : "Preview failed. Please try again.",
        );
    } finally {
      if (token === sequence.current) setRendering(false);
    }
  };
  return (
    <Shell variant="fx" title={t("fx")} back={back}>
      <p className="eyebrow">{t("makeWeird")}</p>
      <div className="fx-chain">
        {chain.map((slot, index) => (
          <div
            className={index === activeSlot ? "fx-slot active" : "fx-slot"}
            key={index}
          >
            <button
              onClick={() => {
                setActiveSlot(index);
                update({
                  effect: slot.effect,
                  effectMix: slot.mix,
                  pitchSemitones: slot.pitchSemitones,
                  echoDelayMs: slot.echoDelayMs,
                  effectChain: chain,
                });
              }}
            >
              {index + 1} · {effectLabel[slot.effect]}
            </button>
            <button
              aria-pressed={!!slot.bypassed}
              onClick={() =>
                void preview({
                  effectChain: chain.map((s, i) =>
                    i === index ? { ...s, bypassed: !s.bypassed } : s,
                  ),
                })
              }
            >
              {t("fxBypass")}
            </button>
            <button
              disabled={index === 0}
              onClick={() => {
                const next = chain.slice();
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                setActiveSlot(index - 1);
                void preview({
                  effectChain: next,
                  effect: next[index - 1].effect,
                  effectMix: next[index - 1].mix,
                  pitchSemitones: next[index - 1].pitchSemitones,
                  echoDelayMs: next[index - 1].echoDelayMs,
                });
              }}
              aria-label={t("fxMove")}
            >
              ↑
            </button>
            <button
              aria-label={t("fxRemove")}
              onClick={() => {
                const next = chain.filter((_, i) => i !== index);
                setActiveSlot(0);
                void preview({
                  effectChain: next,
                  effect: next[0]?.effect || "original",
                  effectMix: next[0]?.mix || 70,
                  pitchSemitones: next[0]?.pitchSemitones || 7,
                  echoDelayMs: next[0]?.echoDelayMs || 340,
                });
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="secondary-button"
          disabled={chain.length >= 3}
          onClick={() => {
            setActiveSlot(chain.length);
            update({
              effect: "original",
              effectMix: 70,
              pitchSemitones: 7,
              echoDelayMs: 340,
              effectChain: [
                ...chain,
                {
                  effect: "original",
                  mix: 70,
                  pitchSemitones: 7,
                  echoDelayMs: 340,
                },
              ],
            });
          }}
        >
          {t("fxAdd")}
        </button>
      </div>
      <div className="effect-grid">
        {EFFECTS.map((effect) => (
          <button
            key={effect}
            className="effect-choice"
            aria-pressed={draft.effect === effect}
            onClick={() => {
              telegram.impact();
              if (effect === "original") setActiveSlot(0);
              void preview({ effect });
            }}
          >
            <FxArtwork effect={effect} />
            <strong>{effectLabel[effect]}</strong>
          </button>
        ))}
      </div>
      {draft.effect === "pitch" && (
        <label className="parameter-control">
          <span>
            <strong>PITCH</strong>
            <small>−12 ↔ +12 SEMITONES</small>
          </span>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={draft.pitchSemitones}
            onChange={(e) =>
              update(
                chainPatch({
                  pitchSemitones: Number(e.target.value),
                  processedBlob: undefined,
                }),
              )
            }
            onKeyUp={(e) =>
              void preview({ pitchSemitones: Number(e.currentTarget.value) })
            }
            onPointerUp={(e) =>
              void preview({ pitchSemitones: Number(e.currentTarget.value) })
            }
          />
          <output>
            {draft.pitchSemitones > 0 ? "+" : ""}
            {draft.pitchSemitones} ST
          </output>
        </label>
      )}
      {draft.effect === "echo" && (
        <label className="parameter-control echo-control">
          <span>
            <strong>{t("echoRate")}</strong>
            <small>
              {t("faster")} ↔ {t("slower")}
            </small>
          </span>
          <input
            type="range"
            min="80"
            max="1000"
            step="10"
            value={draft.echoDelayMs}
            onChange={(e) =>
              update(chainPatch({ echoDelayMs: Number(e.target.value) }))
            }
            onKeyUp={(e) =>
              void preview({ echoDelayMs: Number(e.currentTarget.value) })
            }
            onPointerUp={(e) =>
              void preview({ echoDelayMs: Number(e.currentTarget.value) })
            }
          />
          <output>{draft.echoDelayMs} MS</output>
        </label>
      )}
      <label className="mix-control">
        <strong>MIX</strong>
        <input
          type="range"
          min="0"
          max="100"
          disabled={draft.effect === "original"}
          value={draft.effectMix}
          onChange={(e) =>
            update(
              chainPatch({
                effectMix: Number(e.target.value),
                processedBlob: undefined,
              }),
            )
          }
          onKeyUp={(e) =>
            void preview({ effectMix: Number(e.currentTarget.value) })
          }
          onPointerUp={(e) =>
            void preview({ effectMix: Number(e.currentTarget.value) })
          }
        />
        <output>
          {draft.effect === "original" ? "DRY" : `${draft.effectMix}%`}
        </output>
      </label>
      <div className="fx-preview-controls">
        <button onClick={() => void preview({}, true)}>ORIGINAL</button>
        <button
          onClick={() => {
            if (previewPlaying) {
              sequence.current++;
              player.stop();
              setPreviewPlaying(false);
            } else void preview({});
          }}
        >
          {rendering ? "RENDERING…" : previewPlaying ? "STOP ■" : "PREVIEW ▶"}
        </button>
      </div>
      {previewError && (
        <p className="notice" role="alert">
          {previewError}
        </p>
      )}
      <button className="primary-button" disabled={rendering} onClick={next}>
        CONTINUE →
      </button>
    </Shell>
  );
}

export function EmojiScreen({ draft, update, next, back }: StepProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EmojiCategory>("smileys");
  const [slot, setSlot] = useState(Math.min(draft.emojis.length, 2));
  const all = emojiCategories.flatMap((group) => group.items),
    visible = query.trim()
      ? searchEmoji(query, locale)
      : emojiCategories.find((group) => group.id === category)?.items || [];
  const pick = (emoji: string) => {
    const emojis = [...draft.emojis];
    emojis[slot] = emoji;
    update({ emojis: emojis.slice(0, 3) });
    setSlot(Math.min(2, slot + 1));
    telegram.impact();
  };
  const random = () =>
    update({
      emojis: Array.from(
        { length: 3 },
        () => all[Math.floor(Math.random() * all.length)],
      ),
    });
  return (
    <Shell
      title={t("chooseEmoji")}
      back={back}
      right={
        <button className="tiny-action" onClick={random}>
          ⚄<small>{t("random")}</small>
        </button>
      }
    >
      <p className="eyebrow">{t("describeSound")}</p>
      <div className="emoji-slots">
        {[0, 1, 2].map((i) => (
          <button
            className={slot === i ? "active" : ""}
            key={i}
            aria-pressed={slot === i}
            aria-label={`${i + 1}: ${draft.emojis[i] || "—"}`}
            onClick={() => setSlot(i)}
          >
            <span>{draft.emojis[i] || "·"}</span>
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
      <input
        className="text-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("emojiSearch")}
        aria-label={t("emojiSearch")}
      />
      <div className="emoji-categories" role="tablist">
        {emojiCategories.map((group) => (
          <button
            role="tab"
            aria-selected={category === group.id}
            title={group.label}
            key={group.id}
            onClick={() => {
              setCategory(group.id);
              setQuery("");
            }}
          >
            {group.icon}
          </button>
        ))}
      </div>
      <div
        className="emoji-grid"
        aria-label={
          query
            ? t("emojiSearch")
            : emojiCategories.find((group) => group.id === category)?.label
        }
      >
        {visible.map((emoji) => (
          <button key={emoji} onClick={() => pick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      {query && visible.length === 0 && (
        <p className="empty-emoji">{t("noEmoji")}</p>
      )}
      <button
        className="primary-button"
        disabled={![0, 1, 2].every((i) => Boolean(draft.emojis[i]))}
        onClick={next}
      >
        {t("continue")}
      </button>
    </Shell>
  );
}

interface StepProps {
  draft: SoundDraft;
  update: (p: Partial<SoundDraft>) => void;
  next: () => void;
  back: () => void;
}
function DraftTitlePreview({ draft }: { draft: SoundDraft }) {
  const { t } = useI18n();
  return (
    <p className={`draft-title-preview style-${draft.styleId || "grotesk"}`}>
      {draft.title || t("yourSound")}
    </p>
  );
}
function TitleScreen({ draft, update, next, back }: StepProps) {
  const { t } = useI18n();
  return (
    <Shell title={t("addTitle")} back={back}>
      <p className="eyebrow">{t("nameSound")}</p>
      <input
        autoFocus
        maxLength={40}
        className="text-input title-input"
        value={draft.title || ""}
        onChange={(e) => update({ title: e.target.value })}
        placeholder={t("untitled")}
      />
      <div className="title-preview style-bubble">
        {draft.title || t("yourSound")}
      </div>
      <p className="char-count">{(draft.title || "").length}/40</p>
      <button className="primary-button" onClick={next}>
        {t("continue")}
      </button>
    </Shell>
  );
}
function StyleScreen({ draft, update, next, back }: StepProps) {
  const { t } = useI18n();
  return (
    <Shell title={t("chooseStyle")} back={back}>
      <p className="eyebrow">{t("pickLook")}</p>
      <div className="option-list">
        {STYLES.map((style) => (
          <button
            key={style.id}
            className={draft.styleId === style.id ? "selected" : ""}
            onClick={() => update({ styleId: style.id })}
          >
            <span className={`style-${style.id}`}>
              <strong>{style.label}</strong>
              <small>{draft.title || t("yourSound")}</small>
            </span>
            <i />
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        disabled={!draft.styleId}
        onClick={next}
      >
        {t("continue")}
      </button>
    </Shell>
  );
}
function LocationScreen({ draft, update, next, back }: StepProps) {
  const { t, locale } = useI18n();
  const [cityQuery, setCityQuery] = useState(draft.location?.city || "");
  const [results, setResults] = useState<SoundLocation[]>([]);
  const [placeState, setPlaceState] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const [placeError, setPlaceError] = useState("");
  const searchController = useRef<AbortController | null>(null);
  useEffect(() => () => searchController.current?.abort(), []);
  // Prefix search is served from the FIELD country catalogue, not Nominatim.
  useEffect(() => {
    if (
      Array.from(cityQuery.trim()).length < 2 ||
      (hasResolvableCity(draft) && draft.location?.city === cityQuery)
    )
      return;
    const timer = window.setTimeout(() => void findCity(), 450);
    return () => {
      window.clearTimeout(timer);
      searchController.current?.abort();
    };
  }, [cityQuery, locale]);
  const findCity = async () => {
    if (cityQuery.trim().length < 2) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setPlaceState("loading");
    setResults([]);
    try {
      const found = await searchCities(
        cityQuery.trim(),
        locale,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setResults(found);
        setPlaceState(found.length ? "idle" : "empty");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPlaceState("error");
        setPlaceError(
          t(
            isAuthenticationError(error)
              ? "sessionExpired"
              : "placeSearchError",
          ),
        );
      }
    }
  };
  return (
    <Shell title={t("chooseLocation")} back={back}>
      <p className="eyebrow">{t("optionalApprox")}</p>
      <DraftTitlePreview draft={draft} />
      <div className="location-search">
        <label>
          <span>{t("city")}</span>
          <input
            className="text-input"
            value={cityQuery}
            placeholder={t("citySearch")}
            onChange={(event) => {
              searchController.current?.abort();
              setResults([]);
              setPlaceState("idle");
              setCityQuery(event.target.value);
              update({ location: undefined });
            }}
          />
        </label>
        <button
          className="secondary-button"
          disabled={cityQuery.trim().length < 2 || placeState === "loading"}
          onClick={() => void findCity()}
        >
          {t("searchCityButton")}
        </button>
        <p className="world-privacy">{t("worldPrivacy")}</p>
        {placeState === "loading" && (
          <p className="search-status">{t("searchingPlaces")}</p>
        )}
        {placeState === "empty" && (
          <p className="search-status">{t("placeNotFound")}</p>
        )}
        {placeState === "error" && (
          <p className="search-status" role="alert">
            {placeError || t("placeSearchError")}
          </p>
        )}
        {results.length > 0 && (
          <div className="search-results">
            {results.map(
              (place) =>
                place && (
                  <button
                    key={place.placeId}
                    onClick={() => {
                      update({ location: place });
                      setCityQuery(place.city);
                      setResults([]);
                    }}
                  >
                    <span className="city-mini-map" aria-hidden="true">
                      <i
                        style={{
                          left: `${((place.lng + 180) / 360) * 100}%`,
                          top: `${((90 - place.lat) / 180) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="place-copy">
                      <strong>{place.city}</strong>
                      <small>
                        {[
                          place.englishCity !== place.city
                            ? place.englishCity
                            : undefined,
                          place.nativeCity !== place.city &&
                          place.nativeCity !== place.englishCity
                            ? place.nativeCity
                            : undefined,
                          place.region,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </button>
                ),
            )}
          </div>
        )}
        {hasResolvableCity(draft) && draft.location && (
          <div className="selected-place">
            <strong>✓ {draft.location.city}</strong>
            <small>{draft.location.region}</small>
          </div>
        )}
        <a
          className="geo-attribution"
          href="https://www.geonames.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("geoAttribution")}
        </a>
      </div>
      <div className="option-list location-none">
        <button
          className={!draft.location ? "selected" : ""}
          onClick={() => {
            update({ location: undefined });
            setCityQuery("");
          }}
        >
          <span>
            <strong>{t("noLocation")}</strong>
          </span>
          <i />
        </button>
      </div>
      <button
        className="primary-button"
        disabled={draft.visibility === "world" && !hasResolvableCity(draft)}
        onClick={next}
      >
        {t("continue")}
      </button>
    </Shell>
  );
}
export function VisibilityScreen({ draft, update, next, back }: StepProps) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [code, setCode] = useState("");
  const [groupError, setGroupError] = useState("");
  const [joining, setJoining] = useState(false);
  const loadGroups = useCallback(
    async (signal?: AbortSignal) => {
      if (!GROUP_PUBLISHING_AVAILABLE || !isAuthenticated()) {
        setGroups([]);
        setGroupError("");
        return;
      }
      try {
        const items = await fieldGroups(signal);
        if (!signal?.aborted) {
          setGroups(items);
          setGroupError("");
        }
      } catch (error) {
        if (!signal?.aborted)
          setGroupError(
            t(
              isAuthenticationError(error)
                ? "sessionExpired"
                : "groupsLoadFailed",
            ),
          );
      }
    },
    [t],
  );
  useEffect(() => {
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      setGroups([]);
      void loadGroups(controller.signal);
    };
    refresh();
    window.addEventListener("field-auth-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("field-auth-changed", refresh);
    };
  }, [loadGroups]);
  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setGroupError("");
    try {
      const group = await joinFieldGroup(code);
      await loadGroups();
      update({ visibility: "group", groupId: group.id, groupName: group.name });
      setCode("");
    } catch (error) {
      setGroupError(
        t(isAuthenticationError(error) ? "sessionExpired" : "invalidGroupCode"),
      );
    } finally {
      setJoining(false);
    }
  };
  const authenticated = isAuthenticated();
  const groupEnabled =
    authenticated && GROUP_PUBLISHING_AVAILABLE && groups.length > 0;
  const restrictedLocation = isWorldRestrictedLocation(draft.location);
  const opts: [Visibility, string, string, boolean][] = [
    [
      "private",
      t("private"),
      restrictedLocation ? t("worldRestricted") : t("privateCopy"),
      !restrictedLocation,
    ],
    [
      "world",
      t("world"),
      COMMUNITY_PUBLISHING_AVAILABLE
        ? t("worldCopy")
        : t("publicationUnavailable"),
      authenticated &&
        COMMUNITY_PUBLISHING_AVAILABLE &&
        hasResolvableCity(draft) &&
        !restrictedLocation,
    ],
    [
      "group",
      t("group"),
      GROUP_PUBLISHING_AVAILABLE ? t("groupCopy") : t("backendRequired"),
      groupEnabled,
    ],
  ];
  return (
    <Shell title={t("shareTo")} back={back}>
      {isNativeApp() && !authenticated && <NativeAccount />}
      <p className="eyebrow">{t("shareWhere")}</p>
      {!isNativeApp() && !authenticated && <FieldAccount />}
      <DraftTitlePreview draft={draft} />
      <div className="option-list visibility-list">
        {opts.map(([id, label, copy, enabled]) => (
          <button
            key={id}
            disabled={!enabled}
            className={draft.visibility === id ? "selected" : ""}
            onClick={() =>
              update({
                visibility: id,
                ...(id === "group" && !draft.groupId && groups.length === 1
                  ? { groupId: groups[0].id, groupName: groups[0].name }
                  : {}),
              })
            }
          >
            <span>
              <strong>
                {id === "private" ? "🔒" : id === "group" ? "♧" : "🌍"} {label}
              </strong>
              <small>
                {(id === "world" || id === "private") && restrictedLocation
                  ? t("worldRestricted")
                  : id === "world" && !enabled && COMMUNITY_PUBLISHING_AVAILABLE
                    ? t(authenticated ? "cityRequired" : "sessionExpired")
                    : copy}
              </small>
            </span>
            {enabled ? (
              <i />
            ) : (
              <em>
                {(id === "world" || id === "private") && restrictedLocation
                  ? t("worldRestricted")
                  : id === "world" && COMMUNITY_PUBLISHING_AVAILABLE
                    ? t(authenticated ? "cityRequired" : "sessionExpired")
                    : t("soon")}
              </em>
            )}
          </button>
        ))}
      </div>
      {GROUP_PUBLISHING_AVAILABLE && authenticated && (
        <section className="group-connect-panel">
          <strong>{t("yourGroups")}</strong>
          {groups.map((group) => (
            <button
              key={group.id}
              className={`group-choice ${draft.groupId === group.id ? "selected" : ""}`}
              onClick={() =>
                update({
                  visibility: "group",
                  groupId: group.id,
                  groupName: group.name,
                })
              }
            >
              <span>
                <b>{group.name}</b>
                <small>
                  {group.telegramTitle || t("telegramNotConnected")}
                </small>
              </span>
              <i />
            </button>
          ))}
          <div className="group-code-row">
            <input
              className="text-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={t("groupCode")}
              maxLength={16}
            />
            <button
              disabled={joining || !code.trim()}
              onClick={() => void join()}
            >
              {joining ? "…" : t("joinGroup")}
            </button>
          </div>
          {groupError && (
            <p role="alert" className="search-status">
              {groupError}
            </p>
          )}
        </section>
      )}
      <button
        className="primary-button"
        disabled={
          (draft.visibility !== "private" && !authenticated) ||
          (draft.visibility === "group" && !draft.groupId) ||
          (restrictedLocation && draft.visibility !== "group") ||
          (draft.visibility === "world" && !hasResolvableCity(draft))
        }
        onClick={next}
      >
        {t("continue")}
      </button>
    </Shell>
  );
}

export function ReadyScreen({
  phase,
  seeMap,
  done,
  draft,
  busy,
  notice,
  save,
  exportSound,
  prepared,
  fresh,
  back,
  playing,
  setPlaying,
}: {
  phase: "preparing" | "uploading" | "groupUpload";
  seeMap: () => void;
  done: () => void;
  draft: SoundDraft;
  busy: boolean;
  notice: string;
  save: () => void;
  exportSound?: (blob: Blob) => void;
  prepared?: (
    source: SoundDraft,
    result: { blob: Blob; duration: number; waveform: number[] },
  ) => void;
  fresh: () => void;
  back: () => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [confirmWorld, setConfirmWorld] = useState(false);
  const [file, setFile] = useState<File>();
  const [fileBusy, setFileBusy] = useState(false);
  const [fileStatus, setFileStatus] = useState("");
  const [botUrl, setBotUrl] = useState<string>();
  const restrictedDestination =
    isWorldRestrictedLocation(draft.location) && draft.visibility !== "group";
  useEffect(() => {
    let active = true;
    setFile(undefined);
    setError("");
    void (
      draft.processedBlob
        ? Promise.resolve({
            blob: draft.processedBlob,
            duration: draft.processedDuration ?? draft.duration,
            waveform: draft.processedWaveform ?? draft.waveform,
          })
        : renderDraft(draft)
    )
      .then(async (result) => {
        const preparedFile = await prepareWavFile(
          result.blob,
          draft.title || "Untitled Sound",
        );
        if (active) {
          setFile(preparedFile);
          if (!draft.processedBlob) prepared?.(draft, result);
        }
      })
      .catch((error) => {
        if (active) setError(fileActionErrorMessage(error, t));
      });
    return () => {
      active = false;
    };
  }, [draft, t, prepared]);
  const fileAction = async (action: "share" | "export") => {
    if (!file || fileBusy) return;
    if (action === "export" && exportSound) {
      exportSound(file);
      return;
    }
    setFileBusy(true);
    setFileStatus("");
    setError("");
    try {
      const result = await runFileAction(file, action);
      if (result.destination === "telegram") {
        setFileStatus(t("fileDelivered"));
        setBotUrl(result.botUrl);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setError(fileActionErrorMessage(error, t));
    } finally {
      setFileBusy(false);
    }
  };
  const play = async () => {
    if (playing) {
      player.stop();
      setPlaying(false);
      return;
    }
    try {
      setError("");
      const rendered = draft.processedBlob
        ? { blob: draft.processedBlob }
        : await renderDraft(draft);
      player.play("draft", rendered.blob, setPlaying, draft.loop);
    } catch {
      setError("Audio preview failed. Please try again.");
    }
  };
  const duration =
    draft.processedDuration ??
    draft.trimEnd -
      draft.trimStart +
      (draft.effectMix > 0
        ? draft.effect === "space"
          ? 2.8
          : draft.effect === "echo"
            ? Math.min(3.2, Math.max(0.8, (draft.echoDelayMs / 1000) * 4))
            : 0
        : 0);
  return (
    <Shell title={t("yourSoundTitle")} back={back}>
      <article className="sound-card">
        <div className="sound-heading">
          <div>
            <h2 className={`style-${draft.styleId}`}>
              {draft.title || "Untitled Sound"}
            </h2>
            <p>{draft.location?.city || "Private sound"}</p>
          </div>
          <div className="emoji-row">{draft.emojis.join(" ")}</div>
        </div>
        <Waveform peaks={draft.processedWaveform ?? draft.waveform} />
        <button
          className="play-main"
          onClick={() => void play()}
          aria-label={playing ? "Stop sound" : "Play sound"}
        >
          {playing ? "■" : "▶"}
        </button>
        <p className="sound-stats">
          {formatTime(duration)}
          {draft.processedBlob
            ? ` · ${Math.round(draft.processedBlob.size / 1024)} KB`
            : ""}{" "}
          · {effectLabel[draft.effect]}
        </p>
      </article>
      {(notice || error) && (
        <p className="notice" role="status">
          {error || notice}
        </p>
      )}
      <div className="ready-actions">
        <button
          disabled={busy || !file || restrictedDestination}
          onClick={() =>
            draft.visibility === "world" ? setConfirmWorld(true) : void save()
          }
          aria-label={t("save")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4.2 4.2L19 6.8" />
          </svg>
          <span>{busy ? t(phase) : !file ? t("preparing") : t("save")}</span>
        </button>
        <button
          disabled={!file || fileBusy}
          onClick={() => void fileAction("export")}
        >
          ⇧<span>EXPORT WAV</span>
        </button>
        <button
          disabled={!file || fileBusy}
          onClick={() => void fileAction("share")}
        >
          ↗<span>{t("shareWav")}</span>
        </button>
        <button onClick={fresh}>
          ＋<span>NEW</span>
        </button>
      </div>
      {restrictedDestination && (
        <p className="notice" role="alert">
          {t("worldRestricted")}
        </p>
      )}
      {telegram.isTelegram && (
        <p className="notice">{t("telegramFileNotice")}</p>
      )}
      {fileBusy && (
        <p className="notice" role="status">
          {t("transferringFile")}
        </p>
      )}
      {fileStatus && (
        <p className="notice" role="status">
          {fileStatus}
        </p>
      )}
      {botUrl && (
        <TelegramLink className="secondary-button" href={botUrl}>
          {t("fileBotChat")}
        </TelegramLink>
      )}
      {!file && !error && (
        <p className="notice" role="status">
          {t("preparing")}
        </p>
      )}
      {draft.visibility !== "private" && (
        <p className="notice">{t("publicationLengthNotice")}</p>
      )}
      {notice === t("savedWorld") && (
        <div className="world-success">
          <button className="primary-button" onClick={seeMap}>
            {t("seeMap")}
          </button>
          <button className="secondary-button" onClick={done}>
            {t("done")}
          </button>
        </div>
      )}
      {confirmWorld && (
        <Dialog title={t("worldConfirm")} close={() => setConfirmWorld(false)}>
          <p>{t("worldConsent")}</p>
          <p>{draft.location?.city}</p>
          <p>{t("publicationLengthNotice")}</p>
          <div className="dialog-actions">
            <button
              className="primary-button"
              onClick={() => {
                setConfirmWorld(false);
                void save();
              }}
            >
              {t("publish")}
            </button>
            <button
              className="secondary-button"
              onClick={() => setConfirmWorld(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </Dialog>
      )}
    </Shell>
  );
}

export function Library({
  editRecord,
  seeMap,
  records,
  reload,
  go,
  playingId,
  setPlayingId,
  setNotice,
  notice,
  back,
}: {
  editRecord: (
    record: SoundRecord,
    destination?: "world" | "group",
  ) => Promise<void>;
  seeMap: (record: SoundRecord) => void;
  records: SoundRecord[];
  reload: () => Promise<void>;
  go: (s: Screen) => void;
  playingId?: string;
  setPlayingId: (v?: string) => void;
  setNotice: (v: string) => void;
  notice: string;
  back: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "favorites" | "recents">("all");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<SoundRecord>();
  const [menuRecord, setMenuRecord] = useState<SoundRecord>();
  const { t, locale } = useI18n();
  const [menuFile, setMenuFile] = useState<File>();
  const [fileStatus, setFileStatus] = useState("");
  const [fileBotUrl, setFileBotUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    setMenuFile(undefined);
    setFileStatus("");
    setFileBotUrl(undefined);
    if (menuRecord)
      void prepareWavFile(menuRecord.audioBlob, menuRecord.title)
        .then((file) => {
          if (active) setMenuFile(file);
        })
        .catch((error) => {
          if (active) setFileStatus(fileActionErrorMessage(error, t));
        });
    return () => {
      active = false;
    };
  }, [menuRecord, t]);
  const [renameValue, setRenameValue] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const retryGroup = async (r: SoundRecord) => {
    if (!r.groupPublication || !confirm(t("groupRetryWarning"))) return;
    setActionBusy(true);
    try {
      const result = r.groupPublication.serverId
        ? await retryGroupDelivery(
            r.groupPublication.groupId,
            r.groupPublication.serverId,
          )
        : await publishGroupSound(r.groupPublication.groupId, r);
      await soundsDb.save({
        ...r,
        groupPublication: {
          ...r.groupPublication,
          serverId: result.id,
          state:
            result.telegramDeliveryState === "delivered"
              ? "published"
              : "failed",
        },
      });
      if (result.telegramDeliveryState !== "delivered")
        setNotice(t("savedGroupDeliveryFailed"));
    } catch (error) {
      setNotice(publicationErrorMessage(error, t));
    } finally {
      setActionBusy(false);
      setMenuRecord(undefined);
      try {
        await reload();
      } catch (error) {
        setNotice(publicationErrorMessage(error, t));
      }
    }
  };
  const retryWorld = async (r: SoundRecord) => {
    setActionBusy(true);
    try {
      await uploadWorld(r);
    } catch (error) {
      setNotice(publicationErrorMessage(error, t));
    } finally {
      setActionBusy(false);
      setMenuRecord(undefined);
      try {
        await reload();
      } catch (error) {
        setNotice(publicationErrorMessage(error, t));
      }
    }
  };
  const removePublication = async (r: SoundRecord) => {
    if (!confirm(t("removeWorldConfirm"))) return;
    setActionBusy(true);
    try {
      await unpublishWorld(r);
      await reload();
      setMenuRecord(undefined);
    } catch (error) {
      setNotice(publicationErrorMessage(error, t));
    } finally {
      setActionBusy(false);
    }
  };
  const shown = useMemo(
    () =>
      records
        .filter((r) => filter !== "favorites" || r.favorite)
        .filter((r) =>
          r.title
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .slice(0, filter === "recents" ? 10 : undefined),
    [records, filter, query],
  );
  const play = (r: SoundRecord) =>
    player.play(r.id, r.audioBlob, (v) => setPlayingId(v ? r.id : undefined));
  const remove = async (r: SoundRecord) => {
    if (
      confirm(r.librarySync ? libraryCopy[locale].delete : t("privateDelete"))
    ) {
      player.stop();
      await soundsDb.remove(r.id);
      await reload();
    }
  };
  const favorite = async (r: SoundRecord) => {
    await soundsDb.save({ ...r, favorite: !r.favorite });
    await reload();
  };
  const saveRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    await soundsDb.save({
      ...renaming,
      title: renameValue.trim().slice(0, 40),
    });
    setRenaming(undefined);
    await reload();
  };
  const fileAction = async (action: "share" | "export") => {
    if (!menuFile || actionBusy) return;
    setActionBusy(true);
    setFileStatus("");
    try {
      const result = await runFileAction(menuFile, action);
      if (result.destination === "telegram") {
        setFileStatus(t("fileDelivered"));
        setFileBotUrl(result.botUrl);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setFileStatus(fileActionErrorMessage(error, t));
    } finally {
      setActionBusy(false);
    }
  };
  return (
    <Shell title="LIBRARY" back={back}>
      {!isNativeApp() && (
        <LibrarySyncControl records={records} login={() => go("settings")} />
      )}
      <div className="tabs">
        {(["all", "favorites", "recents"] as const).map((v) => (
          <button
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
            key={v}
          >
            {v === "favorites" ? "FAV" : v.toUpperCase()}
          </button>
        ))}
      </div>
      <input
        className="text-input library-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchLibrary")}
        aria-label={t("searchLibrary")}
      />
      {notice && <p className="notice">{notice}</p>}
      <div className="sound-list">
        {shown.length === 0 ? (
          <div className="empty-state">
            <strong>NO SOUNDS YET</strong>
            <p>Your next strange sound belongs here.</p>
            <button className="secondary-button" onClick={() => go("record")}>
              RECORD NOW
            </button>
          </div>
        ) : (
          shown.map((r) => (
            <article
              key={r.id}
              onClick={(event) => {
                if (
                  !(event.target as Element).closest('button,[role="button"]')
                )
                  play(r);
              }}
            >
              <button
                className="row-play"
                onClick={() => play(r)}
                aria-label={playingId === r.id ? "Stop sound" : "Play sound"}
              >
                {playingId === r.id ? "■" : "▶"}
              </button>
              <Waveform peaks={r.waveform} />
              <div>
                <strong
                  className={`record-title style-${r.styleId || "grotesk"}`}
                  onClick={() => play(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      play(r);
                    }
                  }}
                >
                  {r.title}
                </strong>
                <small>
                  {formatTime(r.duration)} · {r.emojis.join(" ")}
                </small>
                <small className="publication-state">
                  {r.worldPublication
                    ? t(
                        r.worldPublication.state === "published"
                          ? "publishedState"
                          : r.worldPublication.state === "pending"
                            ? "pendingState"
                            : "failedState",
                      )
                    : t("localState")}
                  {r.groupPublication?.state === "published"
                    ? ` · ${t("groupPublishedState")}: ${r.groupPublication.groupName || r.groupName || ""}`
                    : ""}
                </small>
                {r.librarySync && (
                  <small>
                    {
                      libraryCopy[locale][
                        r.librarySync.mutationId ===
                        r.librarySync.syncedMutationId
                          ? "saved"
                          : "pending"
                      ]
                    }
                  </small>
                )}
              </div>
              <button
                className={r.favorite ? "favorite active" : "favorite"}
                onClick={() => void favorite(r)}
                aria-label="Favorite"
              >
                ♡
              </button>
              <button
                className="sound-menu-trigger"
                aria-label={t("soundActions")}
                onClick={() => setMenuRecord(r)}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </article>
          ))
        )}
      </div>
      {menuRecord && (
        <Dialog title={menuRecord.title} close={() => setMenuRecord(undefined)}>
          <div className="sound-actions">
            <button
              disabled={actionBusy}
              onClick={() => {
                void editRecord(menuRecord).catch(() =>
                  setNotice(t("storageFailed")),
                );
                setMenuRecord(undefined);
              }}
            >
              {t("editSaved")}
            </button>
            {COMMUNITY_PUBLISHING_AVAILABLE &&
              menuRecord.worldPublication?.state !== "published" && (
                <button
                  onClick={() => {
                    void editRecord(menuRecord, "world");
                    setMenuRecord(undefined);
                  }}
                >
                  {t("publishWorld")}
                </button>
              )}
            {GROUP_PUBLISHING_AVAILABLE && (
              <button
                onClick={() => {
                  void editRecord(menuRecord, "group");
                  setMenuRecord(undefined);
                }}
              >
                {t("publishGroup")}
              </button>
            )}
            {menuRecord.worldPublication?.state === "published" && (
              <>
                <button onClick={() => seeMap(menuRecord)}>
                  {t("seeMap")}
                </button>
                <button
                  disabled={actionBusy}
                  onClick={() => void removePublication(menuRecord)}
                >
                  {t("removeWorld")}
                </button>
              </>
            )}
            {menuRecord.worldPublication &&
              menuRecord.worldPublication.state !== "published" && (
                <button
                  disabled={actionBusy}
                  onClick={() => void retryWorld(menuRecord)}
                >
                  {t("retry")}
                </button>
              )}
            {menuRecord.groupPublication &&
              menuRecord.groupPublication.state !== "published" && (
                <button
                  disabled={actionBusy}
                  onClick={() => void retryGroup(menuRecord)}
                >
                  {t("retry")} ·{" "}
                  {menuRecord.groupPublication.groupName || t("group")}
                </button>
              )}
            <button
              onClick={() => {
                void favorite(menuRecord);
                setMenuRecord(undefined);
              }}
            >
              {t(menuRecord.favorite ? "unfavorite" : "favorite")}
            </button>
            <button
              onClick={() => {
                setRenaming(menuRecord);
                setRenameValue(menuRecord.title);
                setMenuRecord(undefined);
              }}
            >
              {t("rename")}
            </button>
            <button
              disabled={!menuFile || actionBusy}
              onClick={() => void fileAction("export")}
            >
              {t("exportWav")}
            </button>
            <button
              disabled={!menuFile || actionBusy}
              onClick={() => void fileAction("share")}
            >
              {t("share")}
            </button>
            <button
              className="danger-text"
              onClick={() => {
                void remove(menuRecord);
                setMenuRecord(undefined);
              }}
            >
              {t("delete")}
            </button>
            <button onClick={() => setMenuRecord(undefined)}>
              {t("cancel")}
            </button>
          </div>
          {telegram.isTelegram && (
            <p className="notice">{t("telegramFileNotice")}</p>
          )}
          {!menuFile && !fileStatus && <p role="status">{t("preparing")}</p>}
          {actionBusy && <p role="status">{t("transferringFile")}</p>}
          {fileStatus && (
            <p className="notice" role="status">
              {fileStatus}
            </p>
          )}
          {fileBotUrl && (
            <TelegramLink className="secondary-button" href={fileBotUrl}>
              {t("fileBotChat")}
            </TelegramLink>
          )}
        </Dialog>
      )}
      {renaming && (
        <div className="modal-backdrop">
          <div
            className="rename-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Rename sound"
          >
            <strong>RENAME SOUND</strong>
            <input
              className="text-input"
              maxLength={40}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div>
              <button onClick={() => setRenaming(undefined)}>CANCEL</button>
              <button onClick={() => void saveRename()}>SAVE</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
function Settings({ go, back }: { go: (s: Screen) => void; back: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const languages: [Locale, string][] = [
    ["en", "English"],
    ["ru", "Русский"],
    ["hy", "Հայերեն"],
    ["zh-TW", "繁體中文"],
  ];
  return (
    <Shell title={t("settings")} back={back}>
      {isNativeApp() ? <NativeAccount /> : <FieldAccount />}
      <div className="settings-list">
        {!isNativeApp() && (
          <button onClick={() => go("donate")}>
            <span>⭐ {t("donate")}</span>
            <strong>›</strong>
          </button>
        )}
        <fieldset className="language-picker">
          <legend>{t("appearance")}</legend>
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={theme === value}
              className={theme === value ? "selected" : ""}
              onClick={() => {
                setTheme(value);
                setThemePreference(value);
              }}
            >
              {t(value === "light" ? "lightTheme" : "darkTheme")}
            </button>
          ))}
        </fieldset>
        <div>
          <span>{t("audioQuality")}</span>
          <strong>WAV</strong>
        </div>
        <fieldset className="language-picker">
          <legend>{t("language")}</legend>
          {languages.map(([id, label]) => (
            <button
              className={locale === id ? "selected" : ""}
              key={id}
              onClick={() => setLocale(id)}
            >
              {label}
              <span>{locale === id ? "✓" : ""}</span>
            </button>
          ))}
        </fieldset>
        <button onClick={() => go("about")}>
          <span>{t("about")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("links")}>
          <span>{t("links")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("privacy")}>
          <span>{t("privacy")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("help")}>
          <span>{t("help")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("microphone")}>
          <span>{t("microphone")}</span>
          <strong>›</strong>
        </button>
        {import.meta.env.DEV && (
          <button
            className="dev-action"
            onClick={() => {
              if (confirm("Reset the local FIELD library?"))
                void soundsDb.clear();
            }}
          >
            DEV · RESET INDEXEDDB
          </button>
        )}
      </div>
    </Shell>
  );
}
function ArticleBody({
  article,
  emailAfterLastSection = false,
  donate,
}: {
  article: SettingsArticle;
  emailAfterLastSection?: boolean;
  donate?: () => void;
}) {
  const linkedParagraph = (text: string) =>
    text
      .split(
        /(Tune Tots Lab|TuneTots Lab|Николой Ченом|Никола Чен|Nikola Chen|Նիկոլա Չեն|в виде донатов|Optional donations|Կամավոր աջակցությունը|自願贊助)/g,
      )
      .map((part, index) => {
        const studio = part === "Tune Tots Lab" || part === "TuneTots Lab";
        const author = [
          "Николой Ченом",
          "Никола Чен",
          "Nikola Chen",
          "Նիկոլա Չեն",
        ].includes(part);
        if (
          donate &&
          [
            "в виде донатов",
            "Optional donations",
            "Կամավոր աջակցությունը",
            "自願贊助",
          ].includes(part)
        )
          return (
            <button key={index} className="inline-link" onClick={donate}>
              {part}
            </button>
          );
        return studio || author ? (
          <a
            key={index}
            href={
              studio
                ? EXTERNAL_LINKS.TUNE_TOTS_INSTAGRAM
                : EXTERNAL_LINKS.NIKOLA_INSTAGRAM
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        ) : (
          part
        );
      });
  return (
    <article className="information-article">
      {article.intro && <p className="article-intro">{article.intro}</p>}
      {article.sections.map((section, index) => (
        <section key={`${section.heading || "section"}-${index}`}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{linkedParagraph(paragraph)}</p>
          ))}
          {emailAfterLastSection && index === article.sections.length - 1 && (
            <EmailContact />
          )}
        </section>
      ))}
    </article>
  );
}

function ContactLinks({ includeEmail = true }: { includeEmail?: boolean }) {
  const { t } = useI18n();
  const links = [
    ["Tune Tots Lab · Instagram", EXTERNAL_LINKS.TUNE_TOTS_INSTAGRAM],
    ["Tune Tots Lab · Website", EXTERNAL_LINKS.TUNE_TOTS_WEBSITE],
    ["Tune Tots · Telegram", EXTERNAL_LINKS.TUNE_TOTS_TELEGRAM],
    ["Nikola Chen · Instagram", EXTERNAL_LINKS.NIKOLA_INSTAGRAM],
    ["Nikola Chen · Telegram", EXTERNAL_LINKS.NIKOLA_TELEGRAM],
    ["Nikola Chen · Portfolio", EXTERNAL_LINKS.NIKOLA_PORTFOLIO],
  ] as const;
  return (
    <section className="article-links">
      <h2>{t("contacts")}</h2>
      {links.map(([label, href]) => (
        <a key={href} href={href} target="_blank" rel="noopener noreferrer">
          {label}
          <span>↗</span>
        </a>
      ))}
      {includeEmail && <EmailContact />}
    </section>
  );
}

function InformationScreen({
  kind,
  go,
}: {
  kind: "privacy" | "about" | "help";
  go: (screen: Screen) => void;
}) {
  const { locale } = useI18n();
  const article = settingsContent(locale)[kind];
  return (
    <Shell title={article.title} back={() => go("settings")}>
      <ArticleBody
        article={article}
        emailAfterLastSection={kind === "help"}
        donate={
          !isNativeApp() && kind === "about" ? () => go("donate") : undefined
        }
      />
      {(kind === "about" || kind === "help") && (
        <ContactLinks includeEmail={kind !== "help"} />
      )}
    </Shell>
  );
}

type MicPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable"
  | "unsupported"
  | "checking";
function MicrophoneScreen({ go }: { go: (screen: Screen) => void }) {
  const { locale, t } = useI18n();
  const article = settingsContent(locale).microphone;
  const [status, setStatus] = useState<MicPermissionState>("unknown");
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let permission: PermissionStatus | undefined;
    const updateStatus = () =>
      permission &&
      setStatus(permission.state as "prompt" | "granted" | "denied");
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((value) => {
        permission = value;
        updateStatus();
        value.addEventListener("change", updateStatus);
      })
      .catch(() => setStatus("unknown"));
    return () => permission?.removeEventListener("change", updateStatus);
  }, []);
  const check = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus("granted");
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError")
      )
        setStatus("denied");
      else if (
        error instanceof DOMException &&
        (error.name === "NotFoundError" ||
          error.name === "DevicesNotFoundError")
      )
        setStatus("unavailable");
      else setStatus("unsupported");
    }
  };
  const statusKey = (
    {
      unknown: "micUnknown",
      prompt: "micPrompt",
      granted: "micGranted",
      denied: "micDenied",
      unavailable: "micUnavailable",
      unsupported: "micUnsupported",
      checking: "micChecking",
    } as const
  )[status];
  return (
    <Shell title={article.title} back={() => go("settings")}>
      <ArticleBody article={article} />
      <section className="microphone-status">
        <span>{t("micStatus")}</span>
        <strong>{t(statusKey)}</strong>
        <button
          className="primary-button"
          disabled={status === "checking"}
          onClick={() => void check()}
        >
          {status === "granted" ? t("checkMic") : t("allowMic")}
        </button>
      </section>
    </Shell>
  );
}
function Links({ go }: { go: (s: Screen) => void }) {
  const { t } = useI18n();
  return (
    <Shell title={t("links")} back={() => go("settings")}>
      <div className="links-list">
        <TelegramLink href={EXTERNAL_LINKS.FIELD_TELEGRAM_APP} className="">
          <strong>FIELD · Telegram</strong>
          <small>@field_sound_bot</small>
          <b>›</b>
        </TelegramLink>
        <a
          href={EXTERNAL_LINKS.TUNE_TOTS_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Tune Tots Lab</strong>
          <small>tunetotslab.github.io</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.NIKOLA_PORTFOLIO}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Nikola Chen</strong>
          <small>Portfolio</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.TUNE_TOTS_INSTAGRAM}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Tune Tots Instagram</strong>
          <small>@tunetots_lab</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.TUNE_TOTS_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Website</strong>
          <small>tunetotslab.github.io</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.TUNE_TOTS_TELEGRAM}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Tune Tots · Telegram</strong>
          <small>@tunetots</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.NIKOLA_TELEGRAM}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Nikola Chen · Telegram</strong>
          <small>@nikolachenmusic</small>
          <b>›</b>
        </a>
        <a
          href={EXTERNAL_LINKS.NIKOLA_INSTAGRAM}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Nikola Chen · Instagram</strong>
          <small>@nikolachenmusic</small>
          <b>›</b>
        </a>
      </div>
      <EmailContact />
    </Shell>
  );
}
