import assert from 'node:assert/strict';
import { degrade, finishSamples, loFi, stutter, tapeStop } from '../src/audio/dsp.ts';
import { spectralPitch as pitchShift } from '../src/audio/spectral.ts';
const rate=48000, input=Float32Array.from({length:rate},(_,i)=>.3*Math.sin(2*Math.PI*440*i/rate));
const rms=a=>Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length);
function strongestFrequency(data,low,high){
  let best=0,frequency=0;
  for(let f=low;f<=high;f+=2){
    let re=0,im=0;
    for(let i=6000;i<18000;i++){const phase=2*Math.PI*f*i/rate;re+=data[i]*Math.cos(phase);im+=data[i]*Math.sin(phase);}
    const power=re*re+im*im;
    if(power>best){best=power;frequency=f;}
  }
  return frequency;
}
assert.deepEqual(pitchShift(input,rate,0),input);
for(const [semitones,expected] of [[12,880],[-12,220],[7,659]]){
  const out=pitchShift(input,rate,semitones);
  assert.equal(out.length,input.length);
  assert.ok(out.every(Number.isFinite));
  const peak=strongestFrequency(out,expected-25,expected+25);
  assert.ok(Math.abs(peak-expected)<12,`Pitch ${semitones}: ${peak}Hz vs ${expected}Hz`);
  assert.ok(rms(out)>.03);
  console.log(`PASS pitch ${semitones}: ${peak}Hz, duration retained`);
}
assert.notDeepEqual(degrade(input,rate),input);
const loFiOutput=loFi(input,rate);
assert.notDeepEqual(loFiOutput,input);
assert.ok(rms(loFiOutput)>.03);
assert.notDeepEqual(stutter(input,rate),input);
const stopped=tapeStop(input,rate);
assert.equal(stopped.length,input.length);assert.ok(rms(stopped.slice(-2400))<rms(stopped.slice(0,2400))*.2);
const a=Float32Array.of(0,2,-2,0), b=Float32Array.of(0,1,-1,0);
finishSamples([a,b],rate,false,false,false);
assert.ok(Math.max(...a)<=.981);
assert.equal(a[1]/b[1],2);
const fade=Float32Array.from({length:48000},()=>.3);
finishSamples([fade],rate,true,true,false);
assert.equal(fade[0],0);assert.equal(fade.at(-1),0);
console.log('PASS degradation, stutter, stereo-linked peak safety, fades');
