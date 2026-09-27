import { createRoot, type Root } from "react-dom/client";
import { useState } from "react";
import App, { FxScreen } from "../App";
import { makeFixture } from "./fixture";
import { runAudioChecks } from "./diagnostics";
import "@fontsource-variable/caveat";
import "@fontsource-variable/fraunces";
import "@fontsource/unifrakturcook/700.css";
import "../design-system/tokens.css";
import "../styles.css";
import "../visual-cleanup.css";

function QA() {
  const [draft, setDraft] = useState(makeFixture);
  const [mode, setMode] = useState("menu");
  const [lines, setLines] = useState<string[]>([]);
  const [samples, setSamples] = useState<{ name: string; url: string }[]>([]);
  const [running, setRunning] = useState(false);
  if (mode === "fx")
    return (
      <div className="viewport">
        <FxScreen
          draft={draft}
          update={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          back={() => setMode("menu")}
          next={() => setMode("menu")}
          setPlaying={() => {}}
        />
      </div>
    );
  if (mode === "app") return <App />;
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "auto" }}>
      <h1>FIELD · development QA</h1>
      <p>
        Synthetic test signal only. No microphone access or library changes.
      </p>
      <button className="secondary-button" onClick={() => setMode("fx")}>
        OPEN FX FIXTURE
      </button>{" "}
      <button className="secondary-button" onClick={() => setMode("app")}>
        OPEN APP
      </button>
      <p>
        <button
          className="primary-button"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            setLines([]);
            try {
              const results = await runAudioChecks(draft, (line) =>
                setLines((old) => [...old, line]),
              );
              setSamples(
                results.map((r) => ({
                  name: r.name,
                  url: URL.createObjectURL(r.blob),
                })),
              );
            } catch (error) {
              setLines((old) => [...old, `FAIL ${String(error)}`]);
            } finally {
              setRunning(false);
            }
          }}
        >
          {running ? "RUNNING…" : "RUN AUDIO CHECKS"}
        </button>
      </p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{lines.join("\n")}</pre>
      {samples.map((s) => (
        <p key={s.name}>
          <a href={s.url} download={`FIELD_QA_${s.name}.wav`}>
            {s.name} WAV
          </a>
        </p>
      ))}
    </main>
  );
}
if (import.meta.env.DEV) {
  const hot = import.meta.hot as
    (ImportMeta["hot"] & { data: { root?: Root } }) | undefined;
  const root = hot?.data.root ?? createRoot(document.getElementById("root")!);
  root.render(<QA />);
  hot?.dispose((data) => {
    data.root = root;
  });
}
