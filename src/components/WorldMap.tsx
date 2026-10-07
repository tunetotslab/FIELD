import { isAuthenticated } from "../auth/session";
import { FieldAccount } from "./FieldAccount";
import { useEffect, useRef, useState } from "react";
import {
  worldAudio,
  worldCities,
  worldSounds,
  reportWorldSound,
  reportReasons,
  likeWorldSound,
  worldDownload,
  isAuthenticationError,
  type WorldSound,
  type WorldCity,
} from "../world";
import { COMMUNITY_PUBLISHING_AVAILABLE } from "../config";
import { useI18n } from "../i18n";
import { Shell } from "./Shell";
import { Dialog } from "./Dialog";
import { Waveform } from "./Waveform";
import { FieldGlobe } from "./FieldArtwork";
import { formatTime } from "../audio/utils";
import type { PlaybackManager } from "../audio/player";
import { subscribeForeground } from "../lifecycle";
import { telegram } from "../telegram";

const productionApi = {
  worldAudio,
  worldCities,
  worldSounds,
  reportWorldSound,
  likeWorldSound,
  worldDownload,
};
export function WorldMap({
  focusCity,
  player,
  back,
  api = productionApi,
}: {
  focusCity?: string;
  player: PlaybackManager;
  back: () => void;
  api?: typeof productionApi;
}) {
  const { t } = useI18n();
  const [cities, setCities] = useState<WorldCity[]>([]),
    [selected, setSelected] = useState<WorldCity>(),
    [sounds, setSounds] = useState<WorldSound[]>([]);
  const [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [listLoading, setListLoading] = useState(false),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0),
    [playing, setPlaying] = useState<string>(),
    [fetching, setFetching] = useState<string>(),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    let last = 0;
    const revalidate = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 1000)
        return;
      last = Date.now();
      setRefresh((value) => value + 1);
    };
    const changed = () => {
      setRefresh((value) => value + 1);
      setCities([]);
      setSelected(undefined);
      setSounds([]);
      blobs.current.clear();
      audioController.current?.abort();
      listController.current?.abort();
      player.stop();
    };
    const cleanup = subscribeForeground(revalidate);
    window.addEventListener("field-auth-changed", changed);
    return () => {
      cleanup();
      window.removeEventListener("field-auth-changed", changed);
    };
  }, []);
  const [report, setReport] = useState<WorldSound>(),
    [reportBusy, setReportBusy] = useState(false),
    [reportNotice, setReportNotice] = useState("");
  const [likeBusy, setLikeBusy] = useState<string>(),
    [downloadBusy, setDownloadBusy] = useState<string>();
  const [downloadLinks, setDownloadLinks] = useState<
    Record<string, { url: string; name: string }>
  >({});
  const actionLocks = useRef(new Set<string>());
  const like = async (sound: WorldSound) => {
    const key = `like:${sound.id}`;
    if (actionLocks.current.has(key)) return;
    actionLocks.current.add(key);
    setLikeBusy(sound.id);
    try {
      const result = await api.likeWorldSound(sound.id, !sound.liked);
      setSounds((old) =>
        old.map((item) =>
          item.id === sound.id
            ? { ...item, likes: result.likes, liked: Boolean(result.liked) }
            : item,
        ),
      );
    } catch {
      setError(t("worldActionFailed"));
    } finally {
      actionLocks.current.delete(key);
      setLikeBusy(undefined);
    }
  };
  const download = async (sound: WorldSound) => {
    const key = `download:${sound.id}`;
    if (actionLocks.current.has(key)) return;
    actionLocks.current.add(key);
    setDownloadBusy(sound.id);
    try {
      const { url } = await api.worldDownload(sound.id);
      const name = `${sound.title.replace(/[\x00-\x1f/\\]/g, "-") || "field-sound"}.wav`;
      setDownloadLinks((old) => ({ ...old, [sound.id]: { url, name } }));
      const app = window.Telegram?.WebApp;
      let native = false;
      if (
        telegram.isTelegram &&
        app?.downloadFile &&
        app.isVersionAtLeast?.("8.0")
      )
        try {
          app.downloadFile({ url, file_name: name });
          native = true;
        } catch {
          /* Fall back to an ordinary download link. */
        }
      if (!native) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        anchor.rel = "noopener";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch {
      setError(t("worldActionFailed"));
    } finally {
      actionLocks.current.delete(key);
      setDownloadBusy(undefined);
    }
  };
  const listController = useRef<AbortController | null>(null),
    audioController = useRef<AbortController | null>(null);
  const blobs = useRef(new Map<string, Blob>()),
    playSequence = useRef(0);
  const stop = () => {
    playSequence.current++;
    audioController.current?.abort();
    player.stop();
    setPlaying(undefined);
    setFetching(undefined);
    setProgress(0);
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (!COMMUNITY_PUBLISHING_AVAILABLE) {
      setLoading(false);
      return;
    }
    if (api === productionApi && !isAuthenticated()) {
      setCities([]);
      setSelected(undefined);
      setSounds([]);
      setError("");
      setLoading(false);
      return;
    }
    void api
      .worldCities(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setCities(items);
        setSelected((current) =>
          current ? items.find((city) => city.id === current.id) : undefined,
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            t(
              isAuthenticationError(error)
                ? "sessionExpired"
                : "worldLoadFailed",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh, focusCity, t, api]);
  useEffect(() => {
    stop();
    setSounds([]);
    setCursor(null);
    setListLoading(false);
    if (!selected) return;
    setError("");
    const controller = new AbortController();
    listController.current = controller;
    setListLoading(true);
    void api
      .worldSounds(selected.id, null, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setSounds(page.items);
          setCursor(page.nextCursor);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            t(
              isAuthenticationError(error)
                ? "sessionExpired"
                : "worldLoadFailed",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [selected, refresh, t]);
  useEffect(() => {
    player.onProgress = setProgress;
    return () => {
      playSequence.current++;
      audioController.current?.abort();
      listController.current?.abort();
      player.stop();
      player.onProgress = undefined;
      blobs.current.clear();
    };
  }, [player]);
  const more = async () => {
    if (!selected || !cursor || listLoading) return;
    const controller = new AbortController();
    listController.current = controller;
    setListLoading(true);
    setError("");
    try {
      const page = await api.worldSounds(
        selected.id,
        cursor,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setSounds((old) => [
          ...old,
          ...page.items.filter((item) => !old.some((s) => s.id === item.id)),
        ]);
        setCursor(page.nextCursor);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          t(
            isAuthenticationError(error) ? "sessionExpired" : "worldLoadFailed",
          ),
        );
    } finally {
      if (!controller.signal.aborted) setListLoading(false);
    }
  };
  const play = async (sound: WorldSound) => {
    if (player.currentId === sound.id && blobs.current.has(sound.id)) {
      player.play(
        sound.id,
        blobs.current.get(sound.id)!,
        (value) => setPlaying(value ? sound.id : undefined),
        false,
        false,
        () => setError(t("audioFailed")),
      );
      return;
    }
    stop();
    const sequence = playSequence.current;
    setFetching(sound.id);
    setError("");
    const controller = new AbortController();
    audioController.current = controller;
    try {
      const blob =
        blobs.current.get(sound.id) ||
        (await api.worldAudio(sound.id, controller.signal));
      if (sequence !== playSequence.current || controller.signal.aborted)
        return;
      if (blobs.current.size >= 5)
        blobs.current.delete(blobs.current.keys().next().value!);
      blobs.current.set(sound.id, blob);
      player.play(
        sound.id,
        blob,
        (value) => setPlaying(value ? sound.id : undefined),
        false,
        false,
        () => setError(t("audioFailed")),
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          t(isAuthenticationError(error) ? "sessionExpired" : "audioFailed"),
        );
    } finally {
      if (sequence === playSequence.current) setFetching(undefined);
    }
  };
  const sendReport = async (reason: (typeof reportReasons)[number]) => {
    if (!report) return;
    setReportBusy(true);
    try {
      await api.reportWorldSound(report.id, reason);
      setReport(undefined);
      setReportNotice(t("reportSent"));
    } catch {
      setReportNotice(t("reportFailed"));
    } finally {
      setReportBusy(false);
    }
  };
  return (
    <Shell variant="world" title={t("fieldWorld")} back={back}>
      <div className="world-composition">
        <FieldGlobe
          markers={cities}
          focus={selected || cities.find((city) => city.id === focusCity)}
          onMarker={(marker) =>
            setSelected(cities.find((c) => c.id === marker.id))
          }
        />
      </div>
      {api === productionApi && !isAuthenticated() && <FieldAccount />}
      <p className="world-privacy">{t("worldPrivacy")}</p>
      {loading ? (
        <p role="status">{t("worldLoading")}</p>
      ) : error && !selected ? (
        <p role="alert">{error}</p>
      ) : cities.length === 0 ? (
        <div className="world-empty">
          <strong>{t("noPublic")}</strong>
          <p>
            {t(
              COMMUNITY_PUBLISHING_AVAILABLE
                ? "publishFirst"
                : "publicationUnavailable",
            )}
          </p>
        </div>
      ) : null}
      {COMMUNITY_PUBLISHING_AVAILABLE && (
        <button
          className="secondary-button"
          disabled={loading}
          onClick={() => setRefresh((v) => v + 1)}
        >
          {t("worldRefresh")}
        </button>
      )}
      {cities.length > 0 && (
        <div className="city-picker">
          {cities.map((city) => (
            <button key={city.id} onClick={() => setSelected(city)}>
              {city.city} · {city.count}
            </button>
          ))}
        </div>
      )}
      <p className="hand world-manifesto">{t("manifesto")}</p>
      {selected && (
        <Dialog
          sheet
          title={selected.city}
          close={() => {
            stop();
            setSelected(undefined);
          }}
        >
          <div className="world-city-sheet">
            <button
              className="secondary-button"
              onClick={() => {
                stop();
                setSelected(undefined);
              }}
            >
              {t("done")}
            </button>
            {reportNotice && <p role="status">{reportNotice}</p>}
            {error && (
              <p role="alert">
                {error}
                <button
                  className="secondary-button"
                  onClick={() => setSelected({ ...selected })}
                >
                  {t("retry")}
                </button>
              </p>
            )}
            {sounds.map((sound) => (
              <article className="world-record" key={sound.id}>
                <button
                  className="world-play"
                  onClick={() => void play(sound)}
                  disabled={fetching === sound.id}
                  aria-label={playing === sound.id ? t("pause") : t("play")}
                >
                  <span>{sound.emojis.join(" ")}</span>
                  <strong className={`style-${sound.styleId}`}>
                    {sound.title}
                  </strong>
                  <span>
                    {fetching === sound.id
                      ? t("loading")
                      : playing === sound.id
                        ? "Ⅱ"
                        : "▶"}{" "}
                    · {formatTime(sound.duration)}
                  </span>
                </button>
                <Waveform peaks={sound.waveform} />
                <progress
                  max={sound.duration}
                  value={player.currentId === sound.id ? progress : 0}
                  aria-label={t("play")}
                />
                <div className="world-record-actions">
                  <button
                    className="secondary-button"
                    disabled={downloadBusy === sound.id}
                    onClick={() => void download(sound)}
                  >
                    {downloadBusy === sound.id
                      ? t("loading")
                      : t("worldDownload")}
                  </button>
                  <button
                    className="secondary-button"
                    aria-label={t("worldLike")}
                    aria-pressed={Boolean(sound.liked)}
                    disabled={likeBusy === sound.id}
                    onClick={() => void like(sound)}
                  >
                    {sound.liked ? "♥" : "♡"} {sound.likes || 0}
                  </button>
                  <button
                    className="report-button"
                    onClick={() => {
                      setReport(sound);
                      setReportNotice("");
                    }}
                  >
                    {t("report")}
                  </button>
                </div>
                {downloadLinks[sound.id] && (
                  <a
                    className="world-download-link"
                    href={downloadLinks[sound.id].url}
                    download={downloadLinks[sound.id].name}
                    rel="noopener"
                  >
                    {t("worldSaveFile")}
                  </a>
                )}
              </article>
            ))}
            {listLoading && <p role="status">{t("loading")}</p>}
            {!listLoading && !error && sounds.length === 0 && (
              <p>{t("noCitySounds")}</p>
            )}
            {cursor && (
              <button
                className="secondary-button"
                disabled={listLoading}
                onClick={() => void more()}
              >
                {t("loadMore")}
              </button>
            )}
          </div>
        </Dialog>
      )}
      {report && (
        <Dialog
          title={t("reportTitle")}
          close={() => {
            if (!reportBusy) setReport(undefined);
          }}
        >
          <div className="sound-actions">
            {reportReasons.map((reason) => (
              <button
                key={reason}
                disabled={reportBusy}
                onClick={() => void sendReport(reason)}
              >
                {t(
                  (
                    {
                      privacy: "reportPrivacy",
                      abuse: "reportAbuse",
                      copyright: "reportCopyright",
                      other: "reportOther",
                    } as const
                  )[reason],
                )}
              </button>
            ))}
            <button disabled={reportBusy} onClick={() => setReport(undefined)}>
              {t("cancel")}
            </button>
            {reportNotice && <p role="alert">{reportNotice}</p>}
          </div>
        </Dialog>
      )}
    </Shell>
  );
}
