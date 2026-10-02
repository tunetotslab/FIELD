import { useEffect, useRef, useState } from "react";
import {
  worldAudio,
  worldCities,
  worldSounds,
  reportWorldSound,
  reportReasons,
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

const productionApi = {
  worldAudio,
  worldCities,
  worldSounds,
  reportWorldSound,
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
  const [report, setReport] = useState<WorldSound>(),
    [reportBusy, setReportBusy] = useState(false),
    [reportNotice, setReportNotice] = useState("");
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
    void api
      .worldCities(controller.signal)
      .then((items) => {
        setCities(items);
        if (focusCity) setSelected(items.find((c) => c.id === focusCity));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t("worldLoadFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh, focusCity, t]);
  useEffect(() => {
    stop();
    setSounds([]);
    setCursor(null);
    setError("");
    setListLoading(false);
    if (!selected) return;
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
      .catch(() => {
        if (!controller.signal.aborted) setError(t("worldLoadFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [selected, t]);
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
    } catch {
      if (!controller.signal.aborted) setError(t("worldLoadFailed"));
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
    } catch {
      if (!controller.signal.aborted) setError(t("audioFailed"));
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
          focus={selected}
          onMarker={(marker) =>
            setSelected(cities.find((c) => c.id === marker.id))
          }
        />
      </div>
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
          title={`${selected.city}, ${selected.country}`}
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
                <button
                  className="report-button"
                  onClick={() => {
                    setReport(sound);
                    setReportNotice("");
                  }}
                >
                  {t("report")}
                </button>
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
