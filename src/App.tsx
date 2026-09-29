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
import { formatTime } from "./audio/utils";
import { PlaybackManager } from "./audio/player";
import { soundsDb } from "./storage/db";
import { telegram } from "./telegram";
import { AppNavigationProvider, BrandFooter, Shell } from "./components/Shell";
import { FieldWordmark, Miley } from "./components/Brand";
import { Waveform } from "./components/Waveform";
import { ErrorPanel } from "./components/ErrorPanel";
import { FieldGlobe, FxArtwork } from "./components/FieldArtwork";
import { Daily } from "./components/Daily";
import { tasks, type Task } from "./data/tasks";
import { taskImages } from "./data/taskImages";
import {
  createTaskSelector,
  createImageVariantSelector,
  TASK_ROTATION_MODE,
} from "./data/taskRotation";
import { emojiCategories, searchEmoji, type EmojiCategory } from "./data/emoji";
import { useI18n, type Locale } from "./i18n";
import { COMMUNITY_PUBLISHING_AVAILABLE, EXTERNAL_LINKS } from "./config";
import { countries, searchCities, type CountryOption } from "./data/geo";
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
const selectTask = createTaskSelector(tasks.map((task) => task.id), {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});

function newDraft(
  blob: Blob,
  duration: number,
  waveform: number[],
): SoundDraft {
  return {
    id: crypto.randomUUID(),
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
  const [screen, setScreen] = useState<Screen>("home");
  const [draft, setDraft] = useState<SoundDraft>();
  const [records, setRecords] = useState<SoundRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string>();
  const settingsReturn = useRef<Screen>("home");
  const workflowReturn = useRef<Screen | undefined>(undefined);
  const pendingChallenge = useRef<string | undefined>(undefined);

  const loadLibrary = useCallback(async () => {
    try {
      setRecords(
        (await soundsDb.getAll()).sort((a, b) => b.createdAt - a.createdAt),
      );
    } catch {
      setNotice(
        "Library could not be opened. Private browsing may disable local storage.",
      );
    }
  }, []);
  useEffect(() => {
    telegram.init();
    void loadLibrary();
    return () => player.stop();
  }, [loadLibrary]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  const go = (next: Screen) => {
    if (next === "daily") {
      const id = selectTask(TASK_ROTATION_MODE);
      const task = tasks.find((task) => task.id === id)!;
      const images = taskImages[task.imageId];
      setActiveTask({
        ...task,
        imageSrc:
          images[
            selectImageVariant(task.imageId, images.length, TASK_ROTATION_MODE)
          ],
      });
    }
    if (
      next === "settings" &&
      !["settings", "links", "privacy", "microphone", "about", "help"].includes(
        screen,
      )
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
  const update = (patch: Partial<SoundDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            processedBlob: undefined,
            processedDuration: undefined,
            processedWaveform: undefined,
            ...patch,
          }
        : current,
    );

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice("");
    try {
      const rendered = await renderDraft(draft);
      const record: SoundRecord = {
        id: draft.id,
        title: draft.title?.trim() || "Untitled Sound",
        emojis: draft.emojis,
        styleId: draft.styleId || "grotesk",
        duration: rendered.duration,
        createdAt: draft.createdAt,
        favorite: false,
        location: draft.location,
        visibility: COMMUNITY_PUBLISHING_AVAILABLE
          ? draft.visibility
          : "private",
        effect: draft.effect,
        effectMix: draft.effectMix,
        echoDelayMs: draft.echoDelayMs,
        dailyChallenge: draft.dailyChallenge,
        audioBlob: rendered.blob,
        waveform: rendered.waveform,
      };
      await soundsDb.save(record);
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
            : t("savedPrivate"),
      );
    } catch {
      setNotice(
        "Storage full or audio processing failed. Your original recording is still available on this screen.",
      );
    } finally {
      setBusy(false);
    }
  };

  const exportDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const rendered = draft.processedBlob
        ? { blob: draft.processedBlob }
        : await renderDraft(draft);
      download(rendered.blob, draft.title || "Untitled Sound");
    } catch {
      setNotice("Export failed. Try a shorter recording.");
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
              notice={notice}
              save={save}
              exportSound={exportDraft}
              fresh={() => {
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
              if (next === "record")
                pendingChallenge.current = activeTask!.id;
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
            records={records}
            go={go}
            playingId={playingId}
            setPlayingId={setPlayingId}
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
      <BrandFooter />
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
  const start = useCallback(() => {
    setCaptured(undefined);
    player.stop();
    setPlaying(false);
    setError("");
    recorder.current = new FieldRecorder({
      onState: (next, message) => {
        setState(next);
        if (message) setError(message);
      },
      onTime: setTime,
      onComplete: async (blob, duration) => {
        try {
          const result = await analyze(blob);
          const value = newDraft(
            blob,
            result.duration || duration,
            result.waveform,
          );
          setCaptured(value);
          setTime(value.duration);
          setState("ready");
        } catch {
          setState("error");
          setError("Audio decoding failed. Please make a new recording.");
        }
      },
    });
    recorder.current.attachVisualizer(liveCanvas.current);
    void recorder.current.start();
  }, []);
  useEffect(() => {
    start();
    return () => {
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
        <ErrorPanel message={error} retry={start} />
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
                className={`record-button compact ${state === "recording" ? "recording" : ""}`}
                onClick={() =>
                  state === "paused"
                    ? recorder.current?.resume()
                    : recorder.current?.pause()
                }
                aria-label={
                  state === "paused" ? "Resume recording" : "Pause recording"
                }
              >
                <span>{state === "paused" ? "▶" : "Ⅱ"}</span>
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
      const rendered = await renderDraft({ ...draft, effect: "original" });
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
  useEffect(
    () => () => {
      sequence.current++;
      renderController.current?.abort();
      player.stop();
    },
    [],
  );
  const preview = async (patch: Partial<SoundDraft>, dry = false) => {
    const token = ++sequence.current;
    renderController.current?.abort();
    const controller = new AbortController();
    renderController.current = controller;
    const nextDraft = {
      ...draft,
      ...patch,
      ...(dry ? { effect: "original" as const } : {}),
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
      <div className="effect-grid">
        {EFFECTS.map((effect) => (
          <button
            key={effect}
            className="effect-choice"
            aria-pressed={draft.effect === effect}
            onClick={() => {
              telegram.impact();
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
              update({
                pitchSemitones: Number(e.target.value),
                processedBlob: undefined,
              })
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
            onChange={(e) => update({ echoDelayMs: Number(e.target.value) })}
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
            update({
              effectMix: Number(e.target.value),
              processedBlob: undefined,
            })
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
        disabled={draft.emojis.length !== 3}
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
  const allCountries = useMemo(() => countries(locale), [locale]);
  const [countryQuery, setCountryQuery] = useState(
    draft.location?.country || "",
  );
  const [selectedCountry, setSelectedCountry] = useState<
    CountryOption | undefined
  >(() => {
    if (!draft.location) return undefined;
    return {
      code: draft.location.countryCode,
      name: draft.location.country,
      searchNames: [draft.location.country],
    };
  });
  const [cityQuery, setCityQuery] = useState(draft.location?.city || "");
  const [results, setResults] = useState<SoundLocation[]>([]);
  const [placeState, setPlaceState] = useState<
    "idle" | "loading" | "empty" | "error"
  >("idle");
  const countryResults =
    countryQuery.trim().length && countryQuery !== selectedCountry?.name
      ? allCountries
          .filter((item) =>
            item.searchNames.some((name) =>
              name
                .toLocaleLowerCase()
                .includes(countryQuery.trim().toLocaleLowerCase()),
            ),
          )
          .slice(0, 10)
      : [];
  useEffect(() => {
    if (
      !selectedCountry ||
      cityQuery.trim().length < 2 ||
      cityQuery === draft.location?.city
    ) {
      setResults([]);
      setPlaceState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceState("loading");
      try {
        const found = await searchCities(
          cityQuery.trim(),
          selectedCountry,
          locale,
          controller.signal,
        );
        setResults(found);
        setPlaceState(found.length ? "idle" : "empty");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setPlaceState("error");
      }
    }, 1100);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cityQuery, selectedCountry, locale, draft.location?.city]);
  return (
    <Shell title={t("chooseLocation")} back={back}>
      <p className="eyebrow">{t("optionalApprox")}</p>
      <DraftTitlePreview draft={draft} />
      <div className="location-search">
        <label>
          <span>{t("country")}</span>
          <input
            className="text-input"
            value={countryQuery}
            placeholder={t("countrySearch")}
            onChange={(event) => setCountryQuery(event.target.value)}
          />
        </label>
        {countryResults.length > 0 && (
          <div className="search-results">
            {countryResults.map((item) => (
              <button
                key={item.code}
                onClick={() => {
                  setSelectedCountry(item);
                  setCountryQuery(item.name);
                  setCityQuery("");
                  setResults([]);
                  update({ location: undefined });
                }}
              >
                {item.name}
                <small>{item.code}</small>
              </button>
            ))}
          </div>
        )}
        <label>
          <span>{t("city")}</span>
          <input
            className="text-input"
            value={cityQuery}
            disabled={!selectedCountry}
            placeholder={
              selectedCountry ? t("citySearch") : t("chooseCountryFirst")
            }
            onChange={(event) => setCityQuery(event.target.value)}
          />
        </label>
        {placeState === "loading" && (
          <p className="search-status">{t("searchingPlaces")}</p>
        )}
        {placeState === "empty" && (
          <p className="search-status">{t("placeNotFound")}</p>
        )}
        {placeState === "error" && (
          <p className="search-status" role="alert">
            {t("placeSearchError")}
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
                    {place.city}
                    <small>
                      {[place.region, place.country].filter(Boolean).join(", ")}
                    </small>
                  </button>
                ),
            )}
          </div>
        )}
        {draft.location && (
          <div className="selected-place">
            <strong>✓ {draft.location.city}</strong>
            <small>
              {[draft.location.region, draft.location.country]
                .filter(Boolean)
                .join(", ")}
            </small>
          </div>
        )}
        <a
          className="geo-attribution"
          href="https://www.openstreetmap.org/copyright"
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
      <button className="primary-button" onClick={next}>
        {t("continue")}
      </button>
    </Shell>
  );
}
export function VisibilityScreen({ draft, update, next, back }: StepProps) {
  const { t } = useI18n();
  const opts: [Visibility, string, string, boolean][] = [
    ["private", t("private"), t("privateCopy"), true],
    [
      "world",
      t("world"),
      COMMUNITY_PUBLISHING_AVAILABLE
        ? t("worldCopy")
        : t("publicationUnavailable"),
      COMMUNITY_PUBLISHING_AVAILABLE &&
        Boolean(draft.location?.city && draft.location?.country),
    ],
    ["group", t("group"), t("backendRequired"), false],
  ];
  return (
    <Shell title={t("shareTo")} back={back}>
      <p className="eyebrow">{t("shareWhere")}</p>
      <DraftTitlePreview draft={draft} />
      <div className="option-list visibility-list">
        {opts.map(([id, label, copy, enabled]) => (
          <button
            key={id}
            disabled={!enabled}
            className={draft.visibility === id ? "selected" : ""}
            onClick={() => update({ visibility: id })}
          >
            <span>
              <strong>
                {id === "private" ? "🔒" : id === "group" ? "♧" : "🌍"} {label}
              </strong>
              <small>
                {id === "world" && !enabled && COMMUNITY_PUBLISHING_AVAILABLE
                  ? t("cityRequired")
                  : copy}
              </small>
            </span>
            {enabled ? (
              <i />
            ) : (
              <em>
                {id === "world" && COMMUNITY_PUBLISHING_AVAILABLE
                  ? t("cityRequired")
                  : t("soon")}
              </em>
            )}
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={next}>
        {t("continue")}
      </button>
    </Shell>
  );
}

function ReadyScreen({
  draft,
  busy,
  notice,
  save,
  exportSound,
  fresh,
  back,
  playing,
  setPlaying,
}: {
  draft: SoundDraft;
  busy: boolean;
  notice: string;
  save: () => void;
  exportSound: () => void;
  fresh: () => void;
  back: () => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
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
            <p>
              {draft.location?.city
                ? `${draft.location.city}, ${draft.location.country}`
                : draft.location?.country || "Private sound"}
            </p>
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
          disabled={busy}
          onClick={() => void save()}
          aria-label={t("save")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4.2 4.2L19 6.8" />
          </svg>
          <span>{busy ? "…" : t("save")}</span>
        </button>
        <button disabled={busy} onClick={() => void exportSound()}>
          ⇧<span>EXPORT WAV</span>
        </button>
        <button
          onClick={() => {
            if (!telegram.sendSound({ id: draft.id, title: draft.title })) {
              setPlaying(false);
            }
          }}
        >
          ↗<span>{telegram.isTelegram ? "SEND TO CHAT" : "SHARE"}</span>
        </button>
        <button onClick={fresh}>
          ＋<span>NEW</span>
        </button>
      </div>
    </Shell>
  );
}

function Library({
  records,
  reload,
  go,
  playingId,
  setPlayingId,
  setNotice,
  notice,
  back,
}: {
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
  const [renaming, setRenaming] = useState<SoundRecord>();
  const [renameValue, setRenameValue] = useState("");
  const shown = useMemo(
    () =>
      records
        .filter((r) => filter !== "favorites" || r.favorite)
        .slice(0, filter === "recents" ? 10 : undefined),
    [records, filter],
  );
  const play = (r: SoundRecord) =>
    player.play(r.id, r.audioBlob, (v) => setPlayingId(v ? r.id : undefined));
  const remove = async (r: SoundRecord) => {
    if (confirm(`Delete “${r.title}” permanently?`)) {
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
  const share = async (r: SoundRecord) => {
    try {
      const file = new File([r.audioBlob], `${r.title}.wav`, {
        type: "audio/wav",
      });
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      )
        await navigator.share({
          title: r.title,
          text: `${r.title} — FIELD by Tune Tots Lab`,
          files: [file],
        });
      else setNotice("Sharing is unavailable here. Use Export WAV instead.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice("Sharing failed. Your sound remains in the library.");
    }
  };
  return (
    <Shell title="LIBRARY" back={back}>
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
            <article key={r.id}>
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
                >
                  {r.title}
                </strong>
                <small>
                  {formatTime(r.duration)} · {r.emojis.join(" ")}
                </small>
              </div>
              <button
                className={r.favorite ? "favorite active" : "favorite"}
                onClick={() => void favorite(r)}
                aria-label="Favorite"
              >
                ♡
              </button>
              <details>
                <summary aria-label="Sound menu">⋮</summary>
                <div className="menu">
                  <button onClick={() => void favorite(r)}>
                    {r.favorite ? "UNFAVORITE" : "FAVORITE"}
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(r);
                      setRenameValue(r.title);
                    }}
                  >
                    RENAME
                  </button>
                  <button onClick={() => download(r.audioBlob, r.title)}>
                    EXPORT WAV
                  </button>
                  <button onClick={() => void share(r)}>SHARE</button>
                  <button
                    className="danger-text"
                    onClick={() => void remove(r)}
                  >
                    DELETE
                  </button>
                </div>
              </details>
            </article>
          ))
        )}
      </div>
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
function WorldMap({
  records,
  go,
  playingId,
  setPlayingId,
  back,
}: {
  records: SoundRecord[];
  go: (s: Screen) => void;
  playingId?: string;
  setPlayingId: (id?: string) => void;
  back: () => void;
}) {
  const { t } = useI18n();
  const publicRecords = COMMUNITY_PUBLISHING_AVAILABLE
    ? records.filter(
        (record) =>
          record.visibility === "world" &&
          record.location?.city &&
          record.location?.country,
      )
    : [];
  const groups = useMemo(() => {
    const result = new Map<string, SoundRecord[]>();
    for (const record of publicRecords) {
      const key =
        `${record.location!.city}, ${record.location!.country}`.toLocaleLowerCase();
      result.set(key, [...(result.get(key) || []), record]);
    }
    return result;
  }, [publicRecords]);
  const markers = useMemo(
    () =>
      [...groups.entries()].flatMap(([key, sounds]) => {
        const location = sounds[0].location!;
        if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng))
          return [];
        return [
          {
            id: key,
            city: sounds[0].location!.city!,
            country: sounds[0].location!.country!,
            lat: location.lat,
            lng: location.lng,
            count: sounds.length,
          },
        ];
      }),
    [groups],
  );
  const [selected, setSelected] = useState<string>();
  const sounds = selected ? groups.get(selected) || [] : [];
  return (
    <Shell variant="world" title={t("fieldWorld")} back={back}>
      <div className="world-composition">
        <FieldGlobe
          markers={markers}
          onMarker={(marker) => setSelected(marker.id)}
        />
        <Miley state="world" />
      </div>
      <p className="world-privacy">{t("worldPrivacy")}</p>
      {markers.length === 0 ? (
        <div className="world-empty">
          <strong>{t("noPublic")}</strong>
          <p>
            {COMMUNITY_PUBLISHING_AVAILABLE
              ? t("publishFirst")
              : t("publicationUnavailable")}
          </p>
        </div>
      ) : (
        sounds.length > 0 && (
          <section className="world-sounds">
            <h2>
              {sounds[0].location?.city}, {sounds[0].location?.country}
            </h2>
            {sounds.map((sound) => (
              <button
                key={sound.id}
                onClick={() =>
                  player.play(sound.id, sound.audioBlob, (value) =>
                    setPlayingId(value ? sound.id : undefined),
                  )
                }
              >
                <span>{sound.emojis.join(" ")}</span>
                <strong
                  className={`record-title style-${sound.styleId || "grotesk"}`}
                >
                  {sound.title}
                </strong>
                <i>{playingId === sound.id ? "■" : "▶"}</i>
              </button>
            ))}
          </section>
        )
      )}
      <p className="hand world-manifesto">
        {t("manifesto")
          .split("\n")
          .map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
      </p>
    </Shell>
  );
}
function Settings({ go, back }: { go: (s: Screen) => void; back: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const languages: [Locale, string][] = [
    ["en", "English"],
    ["ru", "Русский"],
    ["hy", "Հայերեն"],
    ["zh-TW", "繁體中文"],
  ];
  return (
    <Shell title={t("settings")} back={back}>
      <div className="settings-list">
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
        <button onClick={() => go("privacy")}>
          <span>{t("privacy")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("microphone")}>
          <span>{t("microphone")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("about")}>
          <span>{t("about")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("help")}>
          <span>{t("help")}</span>
          <strong>›</strong>
        </button>
        <button onClick={() => go("links")}>
          <span>{t("links")}</span>
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
      <BrandFooter />
    </Shell>
  );
}
function ArticleBody({ article }: { article: SettingsArticle }) {
  return (
    <article className="information-article">
      {article.intro && <p className="article-intro">{article.intro}</p>}
      {article.sections.map((section, index) => (
        <section key={`${section.heading || "section"}-${index}`}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

function ContactLinks() {
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
      <a href={EXTERNAL_LINKS.SUPPORT_EMAIL}>
        {t("emailUs")}
        <small>tunetotslab@gmail.com</small>
      </a>
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
      <ArticleBody article={article} />
      {(kind === "about" || kind === "help") && <ContactLinks />}
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
        <a href={EXTERNAL_LINKS.SUPPORT_EMAIL}>
          <strong>{t("emailUs")}</strong>
          <small>tunetotslab@gmail.com</small>
          <b>›</b>
        </a>
      </div>
      <BrandFooter />
    </Shell>
  );
}

function download(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FIELD_${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Sound"}_${new Date().toISOString().slice(0, 10)}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
