import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {existsSync} from 'node:fs';
import { transformWithOxc } from 'vite';
import { wavDuration } from '../server/world.mjs';
import { indexedDB, IDBObjectStore } from 'fake-indexeddb';

// Load the actual client modules, replacing only build-time configuration.
const modules = new Map();
async function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  if (path.endsWith('/config.ts')) return 'data:text/javascript,export const API_URL="https://field.test"';
  let {code} = await transformWithOxc(await readFile(new URL(path, import.meta.url), 'utf8'), path);
  const imports = [...code.matchAll(/from ["'](\.[^"']+)["']/g)];
  for (const match of imports) {
    let resolved = new URL(match[1] + '.ts', new URL(path, import.meta.url));
    if(!existsSync(resolved)) resolved=new URL(match[1]+'/index.ts',new URL(path,import.meta.url));
    const next = await moduleUrl(resolved.href);
    code = code.replace(match[0], `from ${JSON.stringify(next)}`);
  }
  for(const match of [...code.matchAll(/from ["'](@capacitor[^"']+)["']/g)]) {
    code=code.replace(match[0],`from ${JSON.stringify(import.meta.resolve(match[1]))}`);
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

// Reproduce the WebKit Blob re-put failure at the real repository boundary.
// The isolated in-memory database never opens the user's field-audio database.
globalThis.indexedDB=indexedDB;
const {createSoundRepository}=await load('../src/storage/db.ts');
const {StorageError}=await load('../src/storage/errors.ts');
const storageName='field-storage-regression';
const testDb=await new Promise((resolve,reject)=>{
 const open=indexedDB.open(storageName,1);open.onupgradeneeded=()=>open.result.createObjectStore('sounds',{keyPath:'id'});open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
});
const rawWrite = record=>new Promise((resolve,reject)=>{
 const transaction=testDb.transaction('sounds','readwrite');
 try {transaction.objectStore('sounds').put(record);} catch(error){reject(error);return;}
 transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error);
});
const legacyRow={...pcmRecord,worldPublication:undefined,unknownMetadata:{keep:true},editState:{effect:'echo',trimStart:.1,trimEnd:.8},groupPublication:{state:'failed',groupId:'course'}};
await rawWrite(legacyRow);
const nativePut=IDBObjectStore.prototype.put;
const hasBlob = value=>value instanceof Blob || (value && typeof value==='object' && !(value instanceof ArrayBuffer) && Object.values(value).some(hasBlob));
IDBObjectStore.prototype.put=function(value,...args){if(hasBlob(value))throw new DOMException('Error preparing Blob/File data to be stored in object store','UnknownError');return nativePut.call(this,value,...args);};
await assert.rejects(rawWrite(legacyRow),{name:'UnknownError'});
const byteRepository=createSoundRepository(storageName);
const legacyRestored=(await byteRepository.getAll())[0];
assert.deepEqual(await legacyRestored.audioBlob.arrayBuffer(),pcmBytes);
await byteRepository.save({...legacyRestored,title:'Preserved rename'});
const rawStored=await new Promise((resolve,reject)=>{const transaction=testDb.transaction('sounds','readonly');const get=transaction.objectStore('sounds').get(legacyRow.id);get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);});
assert.equal(hasBlob(rawStored),false);
assert.deepEqual(rawStored.__fieldAudioData.render.bytes,pcmBytes);
assert.deepEqual(rawStored.__fieldAudioData.original.bytes,await saved.arrayBuffer());
const migrated=(await byteRepository.getAll())[0];
assert.equal(migrated.title,'Preserved rename');assert.deepEqual(migrated.editState,legacyRow.editState);assert.deepEqual(migrated.groupPublication,legacyRow.groupPublication);assert.deepEqual(migrated.unknownMetadata,legacyRow.unknownMetadata);
assert.deepEqual(await migrated.audioBlob.arrayBuffer(),pcmBytes);assert.deepEqual(await migrated.originalBlob.arrayBuffer(),await saved.arrayBuffer());
const bytePublisher=createWorldPublisher(byteRepository,{publishSound:async record=>{assert.deepEqual(await record.audioBlob.arrayBuffer(),pcmBytes);return {id:'real-client-server',location:current.location};},removeWorldSound:async()=>{}},()=>true,()=>true);
const bytePublished=await bytePublisher.uploadWorld(migrated);
assert.equal(bytePublished.worldPublication.state,'published');
await byteRepository.save({...bytePublished,groupPublication:{...bytePublished.groupPublication,state:'published'}});
assert.equal((await byteRepository.getAll())[0].groupPublication.state,'published');
assert.match(publicationErrorMessage(new StorageError('DB_WRITE',new DOMException('Private details','UnknownError')),key=>key),/publicationStorageFailed \[DB_WRITE:UnknownError\]/);
IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError');};
await assert.rejects(byteRepository.save({...bytePublished,title:'Must not overwrite'}),error=>error instanceof StorageError && error.reason==='QuotaExceededError');
IDBObjectStore.prototype.put=nativePut;
assert.equal((await byteRepository.getAll())[0].title,'Preserved rename');
assert.deepEqual(await (await byteRepository.getAll())[0].audioBlob.arrayBuffer(),pcmBytes);
testDb.close();
console.log('PASS reproduced WebKit UnknownError on Blob put; byte storage repairs legacy save/World/Group state, preserves render/original/FX/unknown metadata and keeps row after quota failure');

// Exercise the actual private-file client with signed Telegram and native SDK.
const {prepareWavFile,runFileAction,FileTransferError,fileActionErrorMessage}=await load('../src/audio/fileActions.ts');
const fullRender=audioBufferToWav(new TestBuffer({length:8000*61,numberOfChannels:1,sampleRate:8000}));
const fullBytes=await fullRender.arrayBuffer();
const preparedFile=await prepareWavFile(new Blob([fullBytes],{type:'application/octet-stream'}),'Legacy export');
assert.equal(wavDuration(await preparedFile.arrayBuffer(),Infinity),61);assert.deepEqual(await preparedFile.arrayBuffer(),fullBytes);
const relayRequests=[];const nativeShares=[];
window.Telegram={WebApp:{initData:'signed-session',isVersionAtLeast:()=>true,shareMessage:id=>nativeShares.push(id)}};
let transferFailure=false;
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://field.test/files/telegram');assert.equal(options.headers.Authorization,'tma signed-session');
 const metadata=JSON.parse(options.body.get('metadata'));relayRequests.push(metadata);
 assert.equal(metadata.user_id,undefined);assert.equal(metadata.chat_id,undefined);
 assert.deepEqual(await options.body.get('audio').arrayBuffer(),fullBytes);
 return Response.json(transferFailure?{code:'FILE_UNCERTAIN'}:{delivered:true,botUrl:'https://t.me/FIELDtestbot',preparedMessageId:'prepared-client'}, {status:transferFailure?409:200});
};
assert.deepEqual(await runFileAction(preparedFile,'export'),{destination:'telegram',botUrl:'https://t.me/FIELDtestbot'});
const recreated=await prepareWavFile(fullRender,'Legacy export');
await runFileAction(recreated,'share');assert.equal(relayRequests[0].clientId,relayRequests[1].clientId);assert.deepEqual(nativeShares,['prepared-client']);
transferFailure=true;await assert.rejects(runFileAction(recreated,'share'),error=>error instanceof FileTransferError && error.code==='FILE_UNCERTAIN');
assert.equal(relayRequests[2].clientId,relayRequests[0].clientId);
assert.match(fileActionErrorMessage(new FileTransferError('FILE_UNCERTAIN',409),key=>key),/fileTransferUnknown.*FILE_UNCERTAIN/);
assert.match(fileActionErrorMessage(new FileTransferError('FILE_TELEGRAM_REJECTED',403),key=>key),/fileTransferDenied/);
// Outside Telegram, native browser sharing still starts within the click.
window.Telegram=undefined;let nativeBrowserShare=false;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:({files})=>{assert.equal(files[0],preparedFile);nativeBrowserShare=true;return Promise.resolve();}}});
const browserSharing=runFileAction(preparedFile,'share');assert.equal(nativeBrowserShare,true);await browserSharing;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:realNavigator});
console.log('PASS actual export/share client: full legacy WAV without decode/storage, signed Telegram relay, stable retry identity, native Telegram selector, visible ambiguous/rejected errors and synchronous browser sharing');

// Real native repository adapter reconstructs independent Blob bytes without a
// WebView database. Only the device boundary is a deterministic fixture.
const {createNativeSoundRepository}=await load('../src/storage/native.ts');
const nativeRows=new Map();let nativeWriteFails=false;
const bridge={
 async listSounds(){return {ids:[...nativeRows.keys()]};},
 async loadSound({id}){return structuredClone(nativeRows.get(id));},
 async saveSound(row){if(nativeWriteFails)throw Error('Disk full');nativeRows.set(row.id,structuredClone(row));},
 async removeSound({id}){nativeRows.delete(id);}
};
const nativeRepository=createNativeSoundRepository(bridge);
const nativeRecord={...normalized,id:'native-one',audioBlob:new Blob([new Uint8Array([0,255,4,7])],{type:'audio/wav'}),originalBlob:new Blob([new Uint8Array([9,8,0])],{type:'audio/mp4'}),effectChain:[{effect:'echo',mix:.3}],unknownMetadata:{keep:'all'},worldPublication:{state:'pending',clientId:'native-publish',ownerUserId:7}};
await nativeRepository.save(nativeRecord);
const reopenedNative=(await createNativeSoundRepository(bridge).getAll())[0];
assert.deepEqual([...new Uint8Array(await reopenedNative.audioBlob.arrayBuffer())],[0,255,4,7]);
assert.deepEqual([...new Uint8Array(await reopenedNative.originalBlob.arrayBuffer())],[9,8,0]);
assert.equal(reopenedNative.originalBlob.type,'audio/mp4');assert.deepEqual(reopenedNative.effectChain,nativeRecord.effectChain);assert.deepEqual(reopenedNative.unknownMetadata,nativeRecord.unknownMetadata);assert.deepEqual(reopenedNative.worldPublication,nativeRecord.worldPublication);
nativeWriteFails=true;await assert.rejects(()=>nativeRepository.save({...nativeRecord,title:'lost'}));assert.equal((await nativeRepository.getAll())[0].title,nativeRecord.title);
await assert.rejects(()=>nativeRepository.clear());assert.equal((await nativeRepository.getAll()).length,1);
await nativeRepository.remove(nativeRecord.id);assert.equal((await nativeRepository.getAll()).length,0);
console.log('PASS native adapter: original/render byte integrity after reopen, metadata/FX/ownership, failed save preserves old row and bulk clear disabled');

// Exercise actual native session/client logic with only its Keychain boundary replaced.
let keychainValue;
const sessionBridge={
 async sessionWrite({value}){keychainValue=value;},
 async sessionRead(){return {value:keychainValue};},
 async sessionRemove(){keychainValue=undefined;}
};
window.Telegram=undefined;
const {createNativeSessionStore}=await load('../src/auth/session.ts');
const sessionApi=createNativeSessionStore(sessionBridge,()=>true);
const sessionValue={token:'field_'+'a'.repeat(43),expiresAt:Date.now()+60000,userId:7,displayName:'Owner',provider:'telegram'};
await sessionApi.setNativeSession(sessionValue);assert.equal(JSON.parse(keychainValue).userId,7);
const recordBeforeSessionChange=nativeRows.size;
globalThis.fetch=async(_url,opts)=>{assert.equal(new Headers(opts.headers).get('Authorization'),`Bearer ${sessionValue.token}`);return Response.json({error:'Unauthorized'},{status:401});};
assert.equal((await sessionApi.authenticatedFetch('https://field.test/world')).status,401);assert.equal(sessionApi.currentSession(),undefined);assert.equal(keychainValue,undefined);assert.equal(nativeRows.size,recordBeforeSessionChange);
await sessionApi.setNativeSession(sessionValue);
let completeOldRequest;
globalThis.fetch=()=>new Promise(resolve=>{completeOldRequest=resolve;});
const oldResponse=sessionApi.authenticatedFetch('https://field.test/world');
const newer={...sessionValue,token:'field_'+'b'.repeat(43),userId:8};await sessionApi.setNativeSession(newer);
completeOldRequest(Response.json({error:'Unauthorized'},{status:401}));await oldResponse;
assert.equal(sessionApi.currentSession().userId,8);assert.equal(JSON.parse(keychainValue).userId,8);
await sessionApi.setNativeSession(undefined);
console.log('PASS native auth client: Keychain session, rejected token prompts login without touching Library; delayed old 401 cannot log out a newer account');
