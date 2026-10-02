import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { wavDuration } from '../server/world.mjs';

// Load the actual client modules, replacing only build-time configuration.
const modules = new Map();
async function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  if (path.endsWith('/config.ts')) return 'data:text/javascript,export const API_URL="https://field.test"';
  let {code} = await transformWithOxc(await readFile(new URL(path, import.meta.url), 'utf8'), path);
  const imports = [...code.matchAll(/from ["'](\.[^"']+)["']/g)];
  for (const match of imports) {
    const resolved = new URL(match[1] + '.ts', new URL(path, import.meta.url));
    const next = await moduleUrl(resolved.href);
    code = code.replace(match[0], `from ${JSON.stringify(next)}`);
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  modules.set(path, url);
  return url;
}
const load = async path => import(await moduleUrl(new URL(path, import.meta.url).href));
const {normalizeRecording, hasResolvableCity, publicationStart} = await load('../src/storage/normalize.ts');
const saved = new Blob([new Uint8Array([1, 2, 3])], {type:'audio/webm'});
const old = {id:'old-sound',audioBlob:saved,duration:999,createdAt:1,title:'Old',emojis:['🌲','🌲','🌲'],visibility:'world',location:{city:'Dilijan',country:'Armenia'},unknownMetadata:{keep:true}};
const normalized = normalizeRecording(old);
assert.equal(normalized.audioBlob, saved);
assert.equal(normalized.originalBlob, undefined, 'Do not invent a pre-FX original');
assert.equal(normalized.worldPublication, undefined, 'Visibility is not proof of publication');
assert.equal(normalized.unknownMetadata, old.unknownMetadata);
assert.deepEqual(normalizeRecording(normalized), normalized);
assert.deepEqual(normalized.waveform, []);
assert.equal(hasResolvableCity(normalized), false);
const current = {...normalized, schemaVersion:1, originalBlob:saved, location:{placeId:'osm:relation:1',city:'Dilijan',country:'Armenia',countryCode:'AM'},worldPublication:{state:'published',serverId:'server',clientId:'client'}};
assert.equal(hasResolvableCity(current), true);
assert.deepEqual(normalizeRecording(current), current);
assert.equal(normalizeRecording({...current,schemaVersion:2}).schemaVersion,2);

// A controlled decoded buffer exercises the real PCM encoder/publication clients.
class TestBuffer {
  constructor({length,numberOfChannels,sampleRate}) {
    Object.assign(this,{length,numberOfChannels,sampleRate,duration:length/sampleRate});
    this.channels = Array.from({length:numberOfChannels},()=>new Float32Array(length).fill(.2));
  }
  getChannelData(channel) {return this.channels[channel];}
  copyToChannel(samples,channel) {this.channels[channel].set(samples);}
}
globalThis.AudioBuffer = TestBuffer;
globalThis.AudioContext = class {
  async decodeAudioData(bytes) {assert.equal(bytes.byteLength,3);return new TestBuffer({length:8000,numberOfChannels:1,sampleRate:8000});}
  async close() {}
};
globalThis.window = {Telegram:{WebApp:{initData:'test-signed-data'}}};
globalThis.localStorage = {getItem:()=>null};
// Reproduce Safari without the newer AbortSignal static methods.
const originalAny = AbortSignal.any, originalTimeout = AbortSignal.timeout;
AbortSignal.any = undefined; AbortSignal.timeout = undefined;
const calls = [];
globalThis.fetch = async (url,options) => {
  calls.push({url,options});
  if (url.endsWith('/cities/resolve')) return Response.json(current.location);
  if (options.body instanceof FormData) {
    const metadata = JSON.parse(options.body.get('metadata'));
    assert.equal(metadata.duration,1, 'Duration comes from decoded audio, not stale metadata');
    assert.deepEqual(metadata.emojis,old.emojis);
    assert.equal(metadata.originalBlob,undefined);
    assert.equal(metadata.unknownMetadata,undefined);
    assert.equal(wavDuration(await options.body.get('audio').arrayBuffer()),1);
    return Response.json({id:'uploaded',telegramDeliveryState:'delivered'});
  }
  return Response.json([]);
};
const {preparePublicationAudio} = await load('../src/audio/publication.ts');
const {publishSound,worldCities,isAuthenticationError} = await load('../src/world.ts');
const {publishGroupSound} = await load('../src/groups.ts');
for (const record of [{...old,location:current.location},current]) {
  await publishSound(record);
  await publishGroupSound('course',record);
  assert.equal(record.audioBlob,saved);
  assert.equal(record.duration,999);
}
await assert.rejects(preparePublicationAudio({...old,audioBlob:undefined}),/preserved/);
await worldCities(new AbortController().signal);
assert.equal(calls.at(-1).options.cache,'no-store');
assert.equal(calls.filter(call=>call.url.endsWith('/world')).length,2);
assert.equal(calls.filter(call=>call.url.endsWith('/sounds')).length,2);
console.log('PASS old/current normalization, preserved source/unknown fields, honest publication state, shared World/Group PCM payload, stale duration, missing audio and GET cache policy');

// Saved PCM publication must not depend on Safari's AudioBuffer constructor,
// decoding context, MIME labels, stale duration or localStorage availability.
const {audioBufferToWav} = await load('../src/audio/utils.ts');
const pcm = audioBufferToWav(new TestBuffer({length:8000,numberOfChannels:2,sampleRate:8000}));
const pcmBytes = await pcm.arrayBuffer();
const savedPcm = new Blob([pcmBytes], {type:'application/octet-stream'});
const savedContext = globalThis.AudioContext;
globalThis.AudioBuffer = undefined;
await publishGroupSound('course',current);
globalThis.AudioContext = undefined;
globalThis.localStorage = {getItem:()=>{throw new DOMException('Denied','SecurityError');}};
const pcmRecord = {...current,audioBlob:savedPcm,originalBlob:saved,duration:999};
await publishSound(pcmRecord); await publishGroupSound('course',pcmRecord);
assert.deepEqual(await pcmRecord.audioBlob.arrayBuffer(),pcmBytes);
assert.equal(pcmRecord.originalBlob,saved);
assert.equal(pcmRecord.duration,999);
const longPcm = audioBufferToWav(new TestBuffer({length:8000*61,numberOfChannels:2,sampleRate:8000}));
const bounded = await preparePublicationAudio({...pcmRecord,audioBlob:longPcm});
assert.equal(bounded.duration,60);
assert.equal(wavDuration(await bounded.audioBlob.arrayBuffer()),60);
const boundedView = new DataView(await bounded.audioBlob.arrayBuffer());
assert.equal(boundedView.getInt16(boundedView.byteLength-2,true),0);
assert.equal(longPcm.size,44+8000*61*2*2);
await assert.rejects(async()=>wavDuration(await longPcm.arrayBuffer()),/Maximum 60 seconds/);
await assert.rejects(preparePublicationAudio({...pcmRecord,audioBlob:new Blob([pcmBytes.slice(0,50)])}),error=>error.step==='AUDIO_WAV');
globalThis.AudioBuffer = TestBuffer; globalThis.AudioContext = savedContext;
globalThis.localStorage = {getItem:()=>null};
console.log('PASS saved mono/stereo PCM uploads without Web Audio/storage, source preservation, actual duration, 60-second public cap/fade and corrupt-WAV stage');
globalThis.fetch=async()=>Response.json({error:'Unauthorized'},{status:401});
await assert.rejects(worldCities(new AbortController().signal),isAuthenticationError);
assert.equal(isAuthenticationError(new Error('Offline')),false);
console.log('PASS expired Telegram session is distinguishable from offline/city lookup failures');

const documentTarget = new EventTarget();
documentTarget.visibilityState='visible';
const windowTarget = new EventTarget();
const timers = new Map();
windowTarget.setInterval = (callback) => {timers.set(1,callback);return 1;};
windowTarget.clearInterval = id => timers.delete(id);
globalThis.document=documentTarget;
globalThis.window=windowTarget;
const {subscribeForeground}=await load('../src/lifecycle.ts');
const {createTaskSelector}=await load('../src/data/taskRotation.ts');
let date=new Date(2026,9,2,23,59),daily,refreshes=0;
const select=createTaskSelector(['one','two','three']);
const refresh=()=>{daily=select('daily',date);refreshes++;};
refresh(); const yesterday=daily;
const cleanup=subscribeForeground(refresh,30000);
documentTarget.visibilityState='hidden';
date=new Date(2026,9,3,0,1);
documentTarget.dispatchEvent(new Event('visibilitychange'));
assert.equal(daily,yesterday);
documentTarget.visibilityState='visible';
documentTarget.dispatchEvent(new Event('visibilitychange'));
assert.notEqual(daily,yesterday);
const today=daily;
windowTarget.dispatchEvent(new Event('focus'));
windowTarget.dispatchEvent(new Event('online'));
assert.equal(daily,today);
date=new Date(2026,9,4,0,1);timers.get(1)();
assert.notEqual(daily,today);
const before=refreshes;cleanup();
documentTarget.dispatchEvent(new Event('visibilitychange'));
windowTarget.dispatchEvent(new Event('focus'));
assert.equal(refreshes,before);assert.equal(timers.size,0);
console.log('PASS foreground/online refresh, overnight Daily rollover, same-day stability, visible midnight timer and listener cleanup');

AbortSignal.any = originalAny; AbortSignal.timeout = originalTimeout;

const {fetchWithDeadline}=await load('../src/network.ts');
let lastSignal;
globalThis.fetch=async(_input,options)=>{lastSignal=options.signal;return new Promise((resolve,reject)=>{if(lastSignal.aborted)reject(new DOMException('Aborted','AbortError'));else lastSignal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});};
const cancel=new AbortController();const cancelledRequest=fetchWithDeadline('https://field.test',{signal:cancel.signal});cancel.abort();
await assert.rejects(cancelledRequest,{name:'AbortError'});assert.ok(lastSignal.aborted);
await assert.rejects(fetchWithDeadline('https://field.test',{},5),error=>error.step==='FIELD_REQUEST' && error.kind==='TIMEOUT');
globalThis.fetch=async(_input,options)=>new Response(new ReadableStream({start(controller){options.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}}));
await assert.rejects(fetchWithDeadline('https://field.test/world',{method:'POST'},5),error=>error.step==='WORLD_UPLOAD' && error.kind==='TIMEOUT');
console.log('PASS compatible network parent cancellation and timeout without Safari static signal helpers');

assert.equal(publicationStart({...normalized,emojis:[]},'world'),'emoji');
assert.equal(publicationStart({...normalized,title:'x'.repeat(81)},'world'),'title');
assert.equal(publicationStart(normalized,'world'),'location');
assert.equal(publicationStart(normalized,'group'),'visibility');
assert.equal(publicationStart(current,'world'),'visibility');
console.log('PASS legacy publication repairs required metadata before requesting server upload');
const {settingsContent}=await load('../src/data/settingsContent.ts');
for(const locale of ['ru','en','hy','zh-TW']) {
 const content=settingsContent(locale);
 assert.equal(content.about.sections.length,6);
 assert.ok(!JSON.stringify(content).includes('Nominatim'));
 assert.ok(JSON.stringify(content.privacy).includes('GeoNames'));
 assert.ok(JSON.stringify(content.about).includes('Tune Tots Lab'));
}
console.log('PASS current localized About, Privacy and Help in all four languages');

const {FieldRequestError, publicationErrorMessage} = await load('../src/world.ts');
const {PublicationAudioError}=await load('../src/audio/publication.ts');
assert.match(publicationErrorMessage(new FieldRequestError(413), key=>key),/publicationTooLarge.*413/);
assert.match(publicationErrorMessage(new FieldRequestError(400,'Please choose the city again'), key=>key),/publicationCityFailed.*400/);
assert.match(publicationErrorMessage(new FieldRequestError(401), key=>key),/sessionExpired.*401/);
assert.equal(publicationErrorMessage(new PublicationAudioError('Unsupported format'), key=>key),'publicationAudioFailed [AUDIO_DECODE]');
assert.match(publicationErrorMessage(new TypeError('Private details'), key=>key),/publicationServiceFailed \[LOCAL:TypeError\]/);
const {NetworkRequestError} = await load('../src/network.ts');
assert.match(publicationErrorMessage(new NetworkRequestError('GROUP_UPLOAD','NETWORK'), key=>key),/publicationNetworkFailed \[GROUP_UPLOAD:NETWORK\]/);
console.log('PASS publication failures distinguish size, city, expired session, local decode and network');

const {patchDraft,changesAudio} = await load('../src/audio/draft.ts');
const draft = {id:'legacy',originalBlob:saved,processedBlob:pcm,processedDuration:1,processedWaveform:[.2],effect:'echo',trimStart:0,trimEnd:1};
for(const patch of [{title:'Rename'},{emojis:['🌧️','🌱','✨']},{location:current.location},{visibility:'world'},{visibility:'group',groupId:'course'},{styleId:'gothic'},{loop:true}]) {
 const next = patchDraft(draft,patch);
 assert.equal(next.processedBlob,pcm);
 assert.equal(next.originalBlob,saved);
 assert.equal(changesAudio(patch),false);
}
for(const patch of [{effect:'reverse'},{effectChain:[]},{trimStart:.2},{fadeOut:true}]) {
 const next = patchDraft(draft,patch);
 assert.equal(next.processedBlob,undefined);assert.equal(next.processedDuration,undefined);assert.equal(next.originalBlob,saved);
}
console.log('PASS metadata preserves saved render/FX; actual audio edits invalidate it');

const {wavFile,shareWav} = await load('../src/audio/export.ts');
const exportFile = wavFile(pcm,'Дождь Bangkok');
assert.match(exportFile.name,/Дождь-Bangkok/);
assert.deepEqual(await exportFile.arrayBuffer(),pcmBytes);
const realNavigator = globalThis.navigator;
let sharingCalled = false;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:({files})=>files[0]===exportFile,share:({files})=>{assert.equal(files[0],exportFile);sharingCalled=true;return Promise.resolve();}}});
const sharing = shareWav(exportFile);
assert.equal(sharingCalled,true,'Native sharing is invoked synchronously in the click, before any await');
await sharing;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:realNavigator});
console.log('PASS WAV sharing carries real saved bytes and preserves native user activation');

const {newId}=await load('../src/id.ts');
const originalRandomUUID=crypto.randomUUID;
crypto.randomUUID=undefined;
const ids=Array.from({length:100},()=>newId());
assert.equal(new Set(ids).size,100);
for(const id of ids) assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const {createWorldPublisher}=await load('../src/storage/publication.ts');
const queued=new Map();let attempts=0,clientId;
const queueRecord={...pcmRecord,worldPublication:undefined};
const repository={save:async record=>queued.set(record.id,record),getAll:async()=>[...queued.values()]};
const publisher=createWorldPublisher(repository,{
 publishSound:async record=>{attempts++;clientId ??=record.worldPublication.clientId;assert.equal(record.worldPublication.clientId,clientId);if(attempts===1)throw new NetworkRequestError('WORLD_UPLOAD','NETWORK');return {id:'server-id',location:current.location};},
 removeWorldSound:async()=>{},
},()=>true,()=>true);
await assert.rejects(publisher.uploadWorld(queueRecord),error=>error.kind==='NETWORK');
assert.equal(queued.get(queueRecord.id).worldPublication.state,'failed');
const recovered=await publisher.uploadWorld(queued.get(queueRecord.id));
assert.equal(recovered.worldPublication.state,'published');assert.equal(recovered.worldPublication.clientId,clientId);
assert.equal(recovered.audioBlob,savedPcm);assert.equal(recovered.originalBlob,saved);
crypto.randomUUID=originalRandomUUID;
console.log('PASS recording/publication UUIDs when Safari randomUUID is absent; real upload queue preserves bytes and idempotency across failure/retry');
