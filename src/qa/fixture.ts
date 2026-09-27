import type { SoundDraft } from '../types';
import { audioBufferToWav, peaksFromBuffer } from '../audio/utils';

/** A local synthetic percussion + harmonic fixture; never records the microphone. */
export function makeFixture(): SoundDraft {
  const rate=48000, buffer=new AudioBuffer({length:rate*2,numberOfChannels:2,sampleRate:rate});
  for(let c=0;c<2;c++){
    const samples=buffer.getChannelData(c); let seed=913+c;
    for(let i=0;i<samples.length;i++){
      const t=i/rate, hit=t%.25, envelope=Math.exp(-hit*22);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=(seed/0x80000000-1)*Math.exp(-hit*70)*.18;
      const tone=.16*Math.sin(2*Math.PI*(c?330:220)*t)+.08*Math.sin(2*Math.PI*880*t);
      samples[i]=(tone*envelope+noise)*Math.min(1,t/.005)*Math.min(1,(2-t)/.01);
    }
  }
  return {id:'field-qa-fixture',originalBlob:audioBufferToWav(buffer),duration:2,trimStart:.1,trimEnd:1.7,effect:'original',effectMix:70,pitchSemitones:7,emojis:['🌱','🚋','✨'],title:'QA — percussion',visibility:'private',createdAt:Date.now(),waveform:peaksFromBuffer(buffer),fadeIn:false,fadeOut:false,loop:false};
}
