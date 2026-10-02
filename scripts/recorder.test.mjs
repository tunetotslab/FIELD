import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
const {code}=await transformWithOxc(await readFile(new URL('../src/audio/recorder.ts',import.meta.url),'utf8'),'recorder.ts');
const {FieldRecorder}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let now=0,stops=0,requests=0;
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
const track={stop(){stops++;},onended:null};
const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
let permission=()=>Promise.resolve(stream);
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:()=>{requests++;return permission();}}},configurable:true});
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
class Recorder{
  static isTypeSupported(){return true;}
  state='inactive';mimeType='audio/webm';
  start(){this.state='recording';}
  pause(){this.state='paused';} resume(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([new Uint8Array(256)])});this.onstop?.();}
}
globalThis.MediaRecorder=Recorder;
globalThis.window={MediaRecorder:Recorder,setTimeout:()=>1,clearTimeout(){}};
globalThis.AudioContext=class {createAnalyser(){return {frequencyBinCount:128,getByteTimeDomainData(a){a.fill(128);}};}createMediaStreamSource(){return {connect(){}};}close(){return Promise.resolve();}};
let states=[],completed;
const events={onState:s=>states.push(s),onLevel(){},onTime(){},onComplete:(blob,duration)=>{completed={blob,duration};}};
const recorder=new FieldRecorder(events);
await recorder.start();now=1000;recorder.pause();now=3000;recorder.resume();now=4000;recorder.pause();now=6000;recorder.stop();
assert.deepEqual(states,['requesting-permission','recording','paused','recording','paused','processing','processing']);
assert.equal(completed.duration,2);assert.equal(stops,1);
console.log('PASS record / pause / resume / stop while paused; active duration 2s');
let resolvePermission;permission=()=>new Promise(resolve=>resolvePermission=resolve);
states=[];completed=undefined;
const cancelled=new FieldRecorder(events);const pending=cancelled.start();cancelled.discard();resolvePermission(stream);await pending;
assert.ok(!states.includes('recording'));assert.equal(completed,undefined);
console.log('PASS late microphone permission after cancel cannot start a ghost recording');
permission=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));
states=[];await new FieldRecorder(events).start();assert.equal(states.at(-1),'error');
console.log('PASS permission denial produces error state');

let deadline;
window.setTimeout=callback=>{deadline=callback;return 1;};
permission=()=>Promise.resolve(stream);
states=[];completed=undefined;
const interrupted=new FieldRecorder(events);await interrupted.start();
// A WebView returns chunks but never dispatches stop. Recovery must be bounded.
interrupted.recorder.onstop=null;
now+=1000;interrupted.stop();assert.equal(completed,undefined);
deadline();assert.ok(completed.blob.size>0);assert.equal(completed.duration,1);
const recovered=completed;interrupted.finish();assert.equal(completed,recovered);
console.log('PASS missing stop event recovers captured bytes once instead of freezing');
