import tuneTotsLogo from "../assets/brand/tune-tots-transparent.png";
import fieldWordmark from "../assets/brand/field-wordmark-grass.png";
import mileyRecord from "../assets/mascot/field-recordings-mascot.png";
import mileyWorld from "../assets/mascot/miley-world-v2.png";
import { EXTERNAL_LINKS } from "../config";

export function TuneTotsLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className="brand-logo-link"
      href={EXTERNAL_LINKS.TUNE_TOTS_INSTAGRAM}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Tune Tots Lab on Instagram"
    >
      <img
        className={`brand-logo ${compact ? "is-compact" : ""}`}
        src={tuneTotsLogo}
        alt="Tune Tots"
      />
    </a>
  );
}

export function FieldWordmark() {
  return <img className="field-wordmark" src={fieldWordmark} width={1944} height={809} alt="FIELD" />;
}

export function Miley({ state }: { state: "record" | "world" }) {
  const source = state === "record" ? mileyRecord : mileyWorld;
  return (
    <img
      className={`miley-art miley-${state}`}
      src={source}
      width={state === "record" ? 1402 : undefined}
      height={state === "record" ? 1122 : undefined}
      alt={
        state === "record"
          ? "Miley holding a field recorder"
          : "Miley making music"
      }
    />
  );
}
