import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EffectId, RecorderState, Screen, SoundDraft, SoundRecord, Visibility } from './types';
import { FieldRecorder } from './audio/recorder';
import { analyze, effectLabel, renderDraft } from './audio/processing';
import { formatTime } from './audio/utils';
import { PlaybackManager } from './audio/player';
import { soundsDb } from './storage/db';
import { telegram } from './telegram';
import { BottomNav, BrandFooter, Shell } from './components/Shell';
import { FieldWordmark, Miley } from './components/Brand';
import { Waveform } from './components/Waveform';
import { ErrorPanel } from './components/ErrorPanel';
import { FieldGlobe, FxArtwork } from './components/FieldArtwork';

const EMPTY_WAVE = Array.from({ length: 96 }, () => .03);
const EMOJIS = ['🌱','💧','🔥','⛰️','🐈','🐦','🚗','🚲','🌳','🏢','☕','🎵','🩷','⭐','☀️','🌸','🚋','✨','🌊','🌙','🪨','🧊','🍃','🚪'];
const STYLES = [{ id:'grotesk', label:'FIELD GROTESK' },{ id:'bubble', label:'BUBBLE GUM' },{ id:'gothic', label:'GOTHIC' },{ id:'times', label:'Times New Roman' },{ id:'italic', label:'ITALIC' },{ id:'experimental', label:'EXPERIMENTAL' }];
const EFFECTS: EffectId[] = ['clean','warm','tape','lofi','glitch','reverse','pitch','space','destroy'];
const player = new PlaybackManager();

function newDraft(blob: Blob, duration: number, waveform: number[]): SoundDraft {
  return { id: crypto.randomUUID(), originalBlob: blob, duration, trimStart: 0, trimEnd: duration, fadeIn: false, fadeOut: false, loop: false, effect: 'clean', effectMix: 70, pitchSemitones: 7, emojis: [], visibility: 'private', createdAt: Date.now(), waveform };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [draft, setDraft] = useState<SoundDraft>();
  const [records, setRecords] = useState<SoundRecord[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string>();

  const loadLibrary = useCallback(async () => {
    try { setRecords((await soundsDb.getAll()).sort((a,b) => b.createdAt - a.createdAt)); }
    catch { setNotice('Library could not be opened. Private browsing may disable local storage.'); }
  }, []);
  useEffect(() => { telegram.init(); void loadLibrary(); return () => player.stop(); }, [loadLibrary]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [screen]);
  const go = (next: Screen) => { player.stop(); setPlayingId(undefined); setNotice(''); setScreen(next); };
  const update = (patch: Partial<SoundDraft>) => setDraft(current => current ? { ...current, processedBlob: undefined, processedDuration: undefined, processedWaveform: undefined, ...patch } : current);

  const save = async () => {
    if (!draft) return;
    setBusy(true); setNotice('');
    try {
      const rendered = await renderDraft(draft);
      const record: SoundRecord = { id: draft.id, title: draft.title?.trim() || 'Untitled Sound', emojis: draft.emojis, styleId: draft.styleId || 'grotesk', duration: rendered.duration, createdAt: draft.createdAt, favorite: false, location: draft.location, visibility: 'private', audioBlob: rendered.blob, waveform: rendered.waveform };
      await soundsDb.save(record); await loadLibrary(); telegram.success(); setDraft({ ...draft, processedBlob: rendered.blob, processedWaveform: rendered.waveform, processedDuration: rendered.duration }); setNotice('Saved privately to your library.');
    } catch { setNotice('Storage full or audio processing failed. Your original recording is still available on this screen.'); }
    finally { setBusy(false); }
  };

  const exportDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try { const rendered = draft.processedBlob ? { blob: draft.processedBlob } : await renderDraft(draft); download(rendered.blob, draft.title || 'Untitled Sound'); }
    catch { setNotice('Export failed. Try a shorter recording.'); } finally { setBusy(false); }
  };

  const content = (() => {
    switch (screen) {
      case 'home': return <Home go={go} />;
      case 'record': return <RecordScreen onDone={value => { setDraft(value); go('edit'); }} onCancel={() => go('home')} />;
      case 'edit': return draft && <EditScreen draft={draft} update={update} next={() => go('fx')} back={() => go('record')} playing={playingId === 'draft'} setPlaying={value => setPlayingId(value ? 'draft' : undefined)} />;
      case 'fx': return draft && <FxScreen draft={draft} update={update} next={() => go('emoji')} back={() => go('edit')} setPlaying={value => setPlayingId(value ? 'draft' : undefined)} />;
      case 'emoji': return draft && <EmojiScreen draft={draft} update={update} next={() => go('title')} back={() => go('fx')} />;
      case 'title': return draft && <TitleScreen draft={draft} update={update} next={() => go('style')} back={() => go('emoji')} />;
      case 'style': return draft && <StyleScreen draft={draft} update={update} next={() => go('location')} back={() => go('title')} />;
      case 'location': return draft && <LocationScreen draft={draft} update={update} next={() => go('visibility')} back={() => go('style')} />;
      case 'visibility': return draft && <VisibilityScreen draft={draft} update={update} next={() => go('ready')} back={() => go('location')} />;
      case 'ready': return draft && <ReadyScreen draft={draft} busy={busy} notice={notice} save={save} exportSound={exportDraft} fresh={() => { setDraft(undefined); go('home'); }} back={() => go('visibility')} playing={playingId === 'draft'} setPlaying={value => setPlayingId(value ? 'draft' : undefined)} />;
      case 'library': return <Library records={records} reload={loadLibrary} go={go} playingId={playingId} setPlayingId={setPlayingId} setNotice={setNotice} notice={notice} />;
      case 'daily': return <Daily go={go} />;
      case 'map': return <Map go={go} />;
      case 'settings': return <Settings go={go} />;
      case 'links': return <Links go={go} />;
      default: return null;
    }
  })();
  return <div className="viewport">{content}</div>;
}

function Home({ go }: { go: (s: Screen) => void }) {
  return <Shell variant="home" right={<button className="icon-button" onClick={() => go('settings')} aria-label="Settings">⚙</button>} nav={<BottomNav go={go} />}>
    <FieldWordmark/>
    <div className="home-illustration"><Miley state="record"/><p className="hand home-caption">Sounds are everywhere ♡</p></div>
    <div className="home-record-zone"><button className="record-button" onClick={() => { telegram.impact('heavy'); go('record'); }} aria-label="Start recording"><span/></button><strong>TAP TO RECORD</strong></div><p className="home-credit">Made by Tune Tots Lab</p>
  </Shell>;
}

function RecordScreen({ onDone, onCancel }: { onDone: (draft: SoundDraft) => void; onCancel: () => void }) {
  const [state, setState] = useState<RecorderState>('idle'); const [time, setTime] = useState(0); const [wave, setWave] = useState<number[]>(EMPTY_WAVE); const [error, setError] = useState('');
  const recorder = useRef<FieldRecorder | undefined>(undefined);
  const start = useCallback(() => {
    recorder.current = new FieldRecorder({ onState: (next, message) => { setState(next); if (message) setError(message); }, onLevel: samples => setWave(samples), onTime: setTime, onComplete: async (blob, duration) => { try { const result = await analyze(blob); onDone(newDraft(blob, duration, result.waveform)); } catch { setState('error'); setError('Audio decoding failed. Please make a new recording.'); } } });
    void recorder.current.start();
  }, [onDone]);
  useEffect(() => { start(); return () => recorder.current?.discard(); }, [start]);
  return <Shell title="RECORDING" back={() => { recorder.current?.discard(); onCancel(); }}>
    {state === 'error' ? <ErrorPanel message={error} retry={start}/> : <>
      <div className="timer">{formatTime(time)}</div><div className="record-wave"><Waveform peaks={wave} live={state === 'recording'} /></div>
      <div className="record-controls"><button className="round-control danger" onClick={() => { if (confirm('Delete this recording?')) { recorder.current?.discard(); onCancel(); } }} aria-label="Delete recording">⌫</button>
      <button className={`record-button compact ${state === 'recording' ? 'recording' : ''}`} onClick={() => state === 'paused' ? recorder.current?.resume() : recorder.current?.pause()} aria-label={state === 'paused' ? 'Resume recording' : 'Pause recording'}><span>{state === 'paused' ? '▶' : 'Ⅱ'}</span></button>
      <button className="round-control" disabled={state === 'processing' || state === 'requesting-permission'} onClick={() => { telegram.impact('medium'); recorder.current?.stop(); }} aria-label="Finish recording">✓</button></div>
      <p className="hand centered">{state === 'requesting-permission' ? 'REQUESTING MICROPHONE…' : state === 'processing' ? 'MAKING YOUR SOUND…' : state === 'paused' ? 'PAUSED — TAKE YOUR TIME ♡' : 'GOOD SOUNDS TAKE TIME ♡'}</p>
    </>}
  </Shell>;
}

function EditScreen({ draft, update, next, back, playing, setPlaying }: { draft: SoundDraft; update: (p: Partial<SoundDraft>) => void; next: () => void; back: () => void; playing: boolean; setPlaying: (v:boolean) => void }) {
  const startPct = draft.trimStart / draft.duration * 100, endPct = draft.trimEnd / draft.duration * 100;
  const preview = async () => { if (playing) { player.stop(); setPlaying(false); } else { const rendered = await renderDraft({ ...draft, effect: 'clean' }); player.play('draft', rendered.blob, setPlaying, draft.loop); } };
  return <Shell title="EDIT" back={back}><div className="trim-editor"><Waveform peaks={draft.waveform} start={startPct/100} end={endPct/100}/><input aria-label="Trim start" className="range start-range" type="range" min="0" max="100" value={startPct} onChange={e => update({ trimStart: Math.min(Number(e.target.value) / 100 * draft.duration, draft.trimEnd - .1) })}/><input aria-label="Trim end" className="range end-range" type="range" min="0" max="100" value={endPct} onChange={e => update({ trimEnd: Math.max(Number(e.target.value) / 100 * draft.duration, draft.trimStart + .1) })}/></div>
    <div className="trim-times"><span>{formatTime(draft.trimStart)}</span><span>{formatTime(draft.trimEnd)}</span></div><button className="play-main" onClick={() => void preview()} aria-label="Preview selection">{playing ? 'Ⅱ' : '▶'}</button>
    <div className="edit-tools"><button className="selected">✂<span>TRIM</span></button><button disabled title="Split is prepared for a later non-destructive editor">＋<span>SPLIT<br/><small>SOON</small></span></button><button className={draft.loop ? 'selected' : ''} onClick={() => update({ loop: !draft.loop })}>↻<span>LOOP</span></button><button className={draft.fadeIn || draft.fadeOut ? 'selected' : ''} onClick={() => update({ fadeIn: !(draft.fadeIn && draft.fadeOut), fadeOut: !(draft.fadeIn && draft.fadeOut) })}>⌁<span>FADE</span></button></div>
    <button className="primary-button" onClick={next}>CONTINUE →</button>
  </Shell>;
}

export function FxScreen({ draft, update, next, back, setPlaying }: { draft: SoundDraft; update: (p: Partial<SoundDraft>) => void; next: () => void; back: () => void; setPlaying:(v:boolean)=>void }) {
  const sequence = useRef(0);
  const renderController = useRef<AbortController | undefined>(undefined);
  const [rendering, setRendering] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => () => { sequence.current++; renderController.current?.abort(); player.stop(); }, []);
  const preview = async (patch: Partial<SoundDraft>, dry = false) => {
    const token = ++sequence.current;
    renderController.current?.abort();
    const controller = new AbortController(); renderController.current = controller;
    const nextDraft = { ...draft, ...patch, ...(dry ? {effect: 'clean' as const} : {}) };
    if (!dry) update({...patch, processedBlob: undefined});
    setRendering(true); setPreviewError(''); player.stop(); setPreviewPlaying(false);
    try {
      const rendered = await renderDraft(nextDraft, controller.signal);
      if (token !== sequence.current) return;
      player.play('draft', rendered.blob, value => { setPreviewPlaying(value); setPlaying(value); }, draft.loop, true);
    } catch (error) { if (token === sequence.current) setPreviewError(error instanceof Error ? error.message : 'Preview failed. Please try again.'); }
    finally { if (token === sequence.current) setRendering(false); }
  };
  return <Shell variant="fx" title="FX" back={back}><p className="eyebrow">MAKE IT WEIRD</p><div className="effect-grid">{EFFECTS.map(effect => <button key={effect} className="effect-choice" aria-pressed={draft.effect === effect} onClick={() => {telegram.impact(); void preview({ effect });}}><FxArtwork effect={effect}/><strong>{effectLabel[effect]}</strong></button>)}</div>
    {draft.effect === 'pitch' && <label className="parameter-control"><span><strong>PITCH</strong><small>−12 ↔ +12 SEMITONES</small></span><input type="range" min="-12" max="12" step="1" value={draft.pitchSemitones} onChange={e => update({ pitchSemitones: Number(e.target.value), processedBlob: undefined })} onKeyUp={() => void preview({ pitchSemitones: draft.pitchSemitones })} onPointerUp={() => void preview({ pitchSemitones: draft.pitchSemitones })}/><output>{draft.pitchSemitones > 0 ? '+' : ''}{draft.pitchSemitones} ST</output></label>}
    <label className="mix-control"><strong>MIX</strong><input type="range" min="0" max="100" disabled={draft.effect==='clean'} value={draft.effectMix} onChange={e => update({ effectMix: Number(e.target.value), processedBlob: undefined })} onKeyUp={() => void preview({effectMix:draft.effectMix})} onPointerUp={() => void preview({ effectMix: draft.effectMix })}/><output>{draft.effect==='clean'?'DRY':`${draft.effectMix}%`}</output></label>
    <div className="fx-preview-controls"><button onClick={()=>void preview({},true)}>ORIGINAL</button><button onClick={()=>{if(previewPlaying){sequence.current++;player.stop();setPreviewPlaying(false);}else void preview({});}}>{rendering?'RENDERING…':previewPlaying?'STOP ■':'PREVIEW ▶'}</button></div>
    {previewError&&<p className="notice" role="alert">{previewError}</p>}<button className="primary-button" disabled={rendering} onClick={next}>CONTINUE →</button>
  </Shell>;
}

function EmojiScreen({ draft, update, next, back }: StepProps) {
  const [query, setQuery] = useState(''); const visible = query ? EMOJIS.filter(e => e.includes(query)) : EMOJIS;
  const toggle = (emoji: string) => { const exists = draft.emojis.includes(emoji); const emojis = exists ? draft.emojis.filter(e => e !== emoji) : draft.emojis.length < 3 ? [...draft.emojis, emoji] : [...draft.emojis.slice(0,2), emoji]; update({ emojis }); telegram.impact(); };
  const random = () => update({ emojis: [...EMOJIS].sort(() => Math.random() - .5).slice(0,3) });
  return <Shell title="CHOOSE 3 EMOJI" back={back} right={<button className="tiny-action" onClick={random}>⚄<small>RANDOM</small></button>}><p className="eyebrow">TELL US WHAT IT SOUNDS LIKE</p><div className="emoji-slots">{[0,1,2].map(i => <button key={i} onClick={() => draft.emojis[i] && toggle(draft.emojis[i])}><span>{draft.emojis[i] || '·'}</span><small>{i+1}</small></button>)}</div><input className="text-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search emoji…" aria-label="Search emoji"/><div className="emoji-grid">{visible.map(emoji => <button className={draft.emojis.includes(emoji) ? 'selected' : ''} key={emoji} onClick={()=>toggle(emoji)}>{emoji}</button>)}</div><button className="primary-button" disabled={draft.emojis.length !== 3} onClick={next}>CONTINUE →</button></Shell>;
}

interface StepProps { draft: SoundDraft; update: (p: Partial<SoundDraft>) => void; next: () => void; back: () => void }
function TitleScreen({ draft, update, next, back }: StepProps) { return <Shell title="ADD TITLE" back={back}><p className="eyebrow">GIVE YOUR SOUND A NAME</p><input autoFocus maxLength={40} className="text-input title-input" value={draft.title || ''} onChange={e=>update({ title:e.target.value })} placeholder="Untitled Sound"/><div className="title-preview style-bubble">{draft.title || 'Your Sound'}</div><p className="char-count">{(draft.title || '').length}/40</p><button className="primary-button" onClick={next}>CONTINUE →</button></Shell>; }
function StyleScreen({ draft, update, next, back }: StepProps) { return <Shell title="CHOOSE STYLE" back={back}><p className="eyebrow">PICK A LOOK FOR YOUR TITLE</p><div className="option-list">{STYLES.map(style=><button key={style.id} className={draft.styleId === style.id ? 'selected' : ''} onClick={()=>update({styleId:style.id})}><span className={`style-${style.id}`}><strong>{style.label}</strong><small>{draft.title || 'Your Sound'}</small></span><i/></button>)}</div><button className="primary-button" disabled={!draft.styleId} onClick={next}>CONTINUE →</button></Shell>; }
function LocationScreen({ draft, update, next, back }: StepProps) {
  const options = [{country:'Armenia'}, {country:'Armenia',city:'Yerevan'}, {country:'Armenia',city:'Dilijan'}];
  const [custom,setCustom]=useState(false); const [country,setCountry]=useState(''); const [city,setCity]=useState('');
  const selected=(o:{country?:string;city?:string})=>draft.location?.country===o.country&&draft.location?.city===o.city;
  return <Shell title="CHOOSE LOCATION" back={back}><p className="eyebrow">OPTIONAL · APPROXIMATE ONLY</p><div className="option-list">{options.map(o=><button key={o.city||o.country} className={selected(o)?'selected':''} onClick={()=>{setCustom(false);update({location:o});}}><span><strong>{o.city||o.country}</strong>{o.city&&<small>{o.country}</small>}</span><i/></button>)}<button className={custom?'selected':''} onClick={()=>setCustom(true)}><span><strong>Other…</strong></span><i/></button>{custom&&<div className="custom-location"><input className="text-input" maxLength={40} placeholder="Country" value={country} onChange={e=>{setCountry(e.target.value);update({location:{country:e.target.value||undefined,city:city||undefined}})}}/><input className="text-input" maxLength={40} placeholder="City" value={city} onChange={e=>{setCity(e.target.value);update({location:{country:country||undefined,city:e.target.value||undefined}})}}/></div>}<button className={!draft.location?'selected':''} onClick={()=>{setCustom(false);update({location:undefined});}}><span><strong>Don't show location</strong></span><i/></button></div><button className="primary-button" onClick={next}>CONTINUE →</button></Shell>;
}
function VisibilityScreen({ draft, update, next, back }: StepProps) { const opts:[Visibility,string,string,boolean][]=[['private','PRIVATE','Only you can see this',true],['group','TUNE TOTS GROUP','Backend connection required',false],['world','FIELD WORLD','Coming in the next phase',false]]; return <Shell title="SHARE TO" back={back}><p className="eyebrow">WHERE DO YOU WANT TO SHARE?</p><div className="option-list visibility-list">{opts.map(([id,label,copy,enabled])=><button key={id} disabled={!enabled} className={draft.visibility===id?'selected':''} onClick={()=>update({visibility:id})}><span><strong>{id==='private'?'▣':id==='group'?'♧':'◎'} {label}</strong><small>{copy}</small></span>{enabled?<i/>:<em>SOON</em>}</button>)}</div><button className="primary-button" onClick={next}>CONTINUE →</button></Shell>; }

function ReadyScreen({draft,busy,notice,save,exportSound,fresh,back,playing,setPlaying}:{draft:SoundDraft;busy:boolean;notice:string;save:()=>void;exportSound:()=>void;fresh:()=>void;back:()=>void;playing:boolean;setPlaying:(v:boolean)=>void}) {
  const [error,setError]=useState('');
  const play=async()=>{if(playing){player.stop();setPlaying(false);return;}try{setError('');const rendered=draft.processedBlob?{blob:draft.processedBlob}:await renderDraft(draft);player.play('draft',rendered.blob,setPlaying,draft.loop);}catch{setError('Audio preview failed. Please try again.');}};
  const duration=draft.processedDuration ?? draft.trimEnd-draft.trimStart+(draft.effect==='space'&&draft.effectMix>0?2.8:0);
  return <Shell title="YOUR SOUND" back={back}>
    <article className="sound-card"><div className="sound-heading"><div><h2 className={`style-${draft.styleId}`}>{draft.title||'Untitled Sound'}</h2><p>{draft.location?.city ? `${draft.location.city}, ${draft.location.country}` : draft.location?.country || 'Private sound'}</p></div><div className="emoji-row">{draft.emojis.join(' ')}</div></div>
      <Waveform peaks={draft.processedWaveform ?? draft.waveform}/><button className="play-main" onClick={()=>void play()} aria-label={playing?'Stop sound':'Play sound'}>{playing?'■':'▶'}</button>
      <p className="sound-stats">{formatTime(duration)}{draft.processedBlob?` · ${Math.round(draft.processedBlob.size/1024)} KB`:''} · {effectLabel[draft.effect]}</p>
    </article>
    {(notice||error)&&<p className="notice" role="status">{error||notice}</p>}
    <div className="ready-actions"><button disabled={busy} onClick={()=>void save()}>▣<span>SAVE</span></button><button disabled={busy} onClick={()=>void exportSound()}>⇧<span>EXPORT WAV</span></button><button onClick={()=>{ if(!telegram.sendSound({id:draft.id,title:draft.title})){ setPlaying(false); } }}>↗<span>{telegram.isTelegram?'SEND TO CHAT':'SHARE'}</span></button><button onClick={fresh}>＋<span>NEW</span></button></div>
  </Shell>;
}

function Library({records,reload,go,playingId,setPlayingId,setNotice,notice}:{records:SoundRecord[];reload:()=>Promise<void>;go:(s:Screen)=>void;playingId?:string;setPlayingId:(v?:string)=>void;setNotice:(v:string)=>void;notice:string}) {
  const [filter,setFilter]=useState<'all'|'favorites'|'recents'>('all'); const [renaming,setRenaming]=useState<SoundRecord>(); const [renameValue,setRenameValue]=useState('');
  const shown=useMemo(()=>records.filter(r=>filter!=='favorites'||r.favorite).slice(0,filter==='recents'?10:undefined),[records,filter]);
  const play=(r:SoundRecord)=>player.play(r.id,r.audioBlob,v=>setPlayingId(v?r.id:undefined));
  const remove=async(r:SoundRecord)=>{if(confirm(`Delete “${r.title}” permanently?`)){player.stop();await soundsDb.remove(r.id);await reload();}};
  const favorite=async(r:SoundRecord)=>{await soundsDb.save({...r,favorite:!r.favorite});await reload();};
  const saveRename=async()=>{if(!renaming||!renameValue.trim())return;await soundsDb.save({...renaming,title:renameValue.trim().slice(0,40)});setRenaming(undefined);await reload();};
  const share=async(r:SoundRecord)=>{try{const file=new File([r.audioBlob],`${r.title}.wav`,{type:'audio/wav'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:r.title,text:`${r.title} — FIELD by Tune Tots Lab`,files:[file]});else setNotice('Sharing is unavailable here. Use Export WAV instead.');}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setNotice('Sharing failed. Your sound remains in the library.');}};
  return <Shell title="LIBRARY" back={()=>go('home')} nav={<BottomNav go={go} active="library"/>}><div className="tabs">{(['all','favorites','recents'] as const).map(v=><button className={filter===v?'active':''} onClick={()=>setFilter(v)} key={v}>{v==='favorites'?'FAV':v.toUpperCase()}</button>)}</div>{notice&&<p className="notice">{notice}</p>}<div className="sound-list">{shown.length===0?<div className="empty-state"><strong>NO SOUNDS YET</strong><p>Your next strange sound belongs here.</p><button className="secondary-button" onClick={()=>go('record')}>RECORD NOW</button></div>:shown.map(r=><article key={r.id}><button className="row-play" onClick={()=>play(r)} aria-label={playingId===r.id?'Stop sound':'Play sound'}>{playingId===r.id?'■':'▶'}</button><Waveform peaks={r.waveform}/><div><strong>{r.title}</strong><small>{formatTime(r.duration)} · {r.emojis.join(' ')}</small></div><button className={r.favorite?'favorite active':'favorite'} onClick={()=>void favorite(r)} aria-label="Favorite">♡</button><details><summary aria-label="Sound menu">⋮</summary><div className="menu"><button onClick={()=>void favorite(r)}>{r.favorite?'UNFAVORITE':'FAVORITE'}</button><button onClick={()=>{setRenaming(r);setRenameValue(r.title);}}>RENAME</button><button onClick={()=>download(r.audioBlob,r.title)}>EXPORT WAV</button><button onClick={()=>void share(r)}>SHARE</button><button className="danger-text" onClick={()=>void remove(r)}>DELETE</button></div></details></article>)}</div>{renaming&&<div className="modal-backdrop"><div className="rename-modal" role="dialog" aria-modal="true" aria-label="Rename sound"><strong>RENAME SOUND</strong><input className="text-input" maxLength={40} autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)}/><div><button onClick={()=>setRenaming(undefined)}>CANCEL</button><button onClick={()=>void saveRename()}>SAVE</button></div></div></div>}</Shell>;
}

function Daily({go}:{go:(s:Screen)=>void}) { return <Shell title="DAILY SOUND" back={()=>go('home')} nav={<BottomNav go={go} active="daily"/>}><article className="daily-card"><p className="daily-date">TODAY · METAL</p><h2 className="hand">SOMETHING<br/>METALLIC</h2><div className="daily-photo-required" role="img" aria-label="Daily metallic photographic asset required"><span>REQUIRED PHOTOGRAPHIC ASSET</span><strong>daily-metallic.jpg</strong><small>LO-FI · PINHOLE · METAL</small></div><p>Find a ring, rattle or shimmer. Record what metal sounds like where you are.</p><button className="primary-button" onClick={()=>go('record')}>RECORD NOW</button></article></Shell>; }
function Map({go}:{go:(s:Screen)=>void}) { return <Shell variant="world" title="FIELD WORLD" back={()=>go('home')} nav={<BottomNav go={go} active="map"/>}><div className="world-composition"><FieldGlobe/><button className="world-pin world-pin-yerevan"><b>♫</b><span>YEREVAN<small>12 SOUNDS</small></span></button><button className="world-pin world-pin-dilijan"><b>◉</b><span>DILIJAN<small>7 SOUNDS</small></span></button><Miley state="world"/></div><p className="world-privacy">CITY-LEVEL LOCATIONS ONLY · NO EXACT GPS</p><p className="hand world-manifesto">REAL PEOPLE<br/>REAL SOUNDS<br/>A BRIGHTER WORLD ♡</p></Shell>; }
function Settings({go}:{go:(s:Screen)=>void}) { const [normalize,setNormalize]=useState(true);const [autoSave,setAutoSave]=useState(true);return <Shell title="SETTINGS" back={()=>go('home')}><div className="settings-list"><button><span>Audio Quality</span><strong>WAV ›</strong></button><button onClick={()=>setNormalize(v=>!v)}><span>Auto Normalize</span><i className={normalize?'switch on':'switch'}/></button><button onClick={()=>setAutoSave(v=>!v)}><span>Save to Library</span><i className={autoSave?'switch on':'switch'}/></button><button><span>Language</span><strong>EN ›</strong></button><button><span>About FIELD</span><strong>›</strong></button><button><span>Help & Support</span><strong>›</strong></button><button><span>Rate the App</span><strong>›</strong></button><button onClick={()=>go('links')}><span>Links</span><strong>›</strong></button>{import.meta.env.DEV&&<button className="dev-action" onClick={()=>{if(confirm('Reset the local FIELD library?'))void soundsDb.clear();}}>DEV · RESET INDEXEDDB</button>}</div><div className="asset-note"><strong>REQUIRED ASSETS</strong><p>daily-metallic.jpg · 9 approved FIELD FX objects</p></div><BrandFooter/></Shell>; }
function Links({go}:{go:(s:Screen)=>void}) { return <Shell title="LINKS" back={()=>go('settings')}><div className="links-list"><a href="https://tunetotslab.com" target="_blank" rel="noreferrer"><strong>Tune Tots Lab</strong><small>School & community</small><b>›</b></a><div><strong>Nikola Chen</strong><small>Music & projects</small><b>›</b></div><a href="https://instagram.com/tunetotslab" target="_blank" rel="noreferrer"><strong>Tune Tots Instagram</strong><small>@tunetotslab</small><b>›</b></a><a href="https://tunetotslab.com" target="_blank" rel="noreferrer"><strong>Website</strong><small>tunetotslab.com</small><b>›</b></a><div><strong>More Apps</strong><small>Coming soon</small><b>›</b></div></div><BrandFooter/></Shell>; }

function download(blob: Blob, title: string) { const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`FIELD_${title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'Sound'}_${new Date().toISOString().slice(0,10)}.wav`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
