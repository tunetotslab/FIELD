import { createRoot, type Root } from "react-dom/client";
import { useState } from "react";
import App, { EmojiScreen, FxScreen, VisibilityScreen, Library } from "../App";
import { AppNavigationProvider } from "../components/Shell";
import { I18nProvider } from "../i18n";
import { makeFixture } from "./fixture";
import { runAudioChecks } from "./diagnostics";
import {WorldMap} from '../components/WorldMap';
import {PlaybackManager} from '../audio/player';
import type {WorldCity,WorldSound} from '../world';
const qaPlayer=new PlaybackManager();
const qaCity:WorldCity={id:'qa-city',placeId:'qa-city',city:'Yerevan · QA fixture',country:'Armenia',countryCode:'AM',lat:40.177,lng:44.503,count:21};
const qaApi={worldCities:async()=>[qaCity],worldSounds:async(_city:string,cursor:string|null)=>({items:Array.from({length:cursor?1:20},(_,index):WorldSound=>({id:`qa-${cursor?20:index}`,title:`QA sample ${cursor?20:index} — never published`,emojis:['🌧️','🌱','✨'],duration:2,createdAt:0,styleId:'grotesk',waveform:makeFixture().waveform,location:qaCity})),nextCursor:cursor?null:'page-two'}),worldAudio:async()=>makeFixture().originalBlob,reportWorldSound:async()=>({ok:true})};
import "@fontsource-variable/caveat";
import "@fontsource-variable/fraunces";
import "@fontsource/unifrakturcook/700.css";
import "../design-system/tokens.css";
import "../styles.css";
import "../visual-cleanup.css";
import "../responsive.css";

function QA() {
  const [draft, setDraft] = useState(makeFixture);
  const [mode, setMode] = useState("menu");
  const [lines, setLines] = useState<string[]>([]);
  const [samples, setSamples] = useState<{ name: string; url: string }[]>([]);
  const [running, setRunning] = useState(false);
  if(mode==='world') return <div className="viewport"><p>QA ONLY · synthetic recordings, isolated backend fixture, no production uploads</p><WorldMap player={qaPlayer} api={qaApi} back={()=>setMode('menu')}/></div>;
  if (mode === 'library') return <div className="viewport"><Library editRecord={async () => setMode('fx')} seeMap={() => setMode('app')} records={[{...draft, id:'qa-only-not-saved',title:'A very long recording title — QA fixture',styleId:'grotesk',favorite:false,audioBlob:draft.originalBlob}]} reload={async () => {}} go={() => setMode('menu')} back={() => setMode('menu')} setPlayingId={() => {}} setNotice={() => {}} notice="QA fixture — no real recording" /></div>;
  if (mode === "fx")
    return (
      <div className="viewport">
        <AppNavigationProvider
          screen="fx"
          go={(screen) => {
            if (screen === "home") setMode("app");
          }}
        >
          <FxScreen
            draft={draft}
            update={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            back={() => setMode("menu")}
            next={() => setMode("menu")}
            setPlaying={() => {}}
          />
        </AppNavigationProvider>
      </div>
    );
  if (mode === "emoji")
    return (
      <div className="viewport">
        <EmojiScreen
          draft={draft}
          update={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          back={() => setMode("menu")}
          next={() => setMode("menu")}
        />
      </div>
    );
  if (mode === "share")
    return (
      <div className="viewport">
        <VisibilityScreen
          draft={draft}
          update={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          back={() => setMode("menu")}
          next={() => setMode("menu")}
        />
      </div>
    );
  if (mode === "app") return <App />;
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "auto" }}>
      <h1>FIELD · development QA</h1>
      <button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }}>TOGGLE QA PALETTE</button>
      <button onClick={() => setMode('library')}>OPEN LIBRARY FIXTURE</button>
      <p>
        Synthetic test signal only. No microphone access or library changes.
      </p>
      <button className="secondary-button" onClick={() => setMode("fx")}>
        OPEN FX FIXTURE
      </button>{" "}
      <button className="secondary-button" onClick={() => setMode('world')}>OPEN WORLD FIXTURE</button>
      <button className="secondary-button" onClick={() => setMode("emoji")}>
        OPEN EMOJI FIXTURE
      </button>{" "}
      <button className="secondary-button" onClick={() => setMode("share")}>
        OPEN SHARE FIXTURE
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
  root.render(
    <I18nProvider>
      <QA />
    </I18nProvider>,
  );
  hot?.dispose((data) => {
    data.root = root;
  });
}
