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
const {normalizeRecording, hasResolvableCity} = await load('../src/storage/normalize.ts');
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
const {publishSound,worldCities} = await load('../src/world.ts');
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
