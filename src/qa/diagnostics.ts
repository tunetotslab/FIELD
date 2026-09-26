import { renderDraft } from '../audio/processing';
import { decodeBlob } from '../audio/utils';
import type { EffectId, SoundDraft } from '../types';
import { createSoundRepository } from '../storage/db';
export async function runAudioChecks(fixture:SoundDraft, report:(line:string)=>void) {
  let checks=0;
  const assert=(condition:boolean,label:string)=>{if(!condition)throw new Error(label);checks++;};
  const clean=await renderDraft({...fixture,effect:'clean'});
  const cleanBuffer=await decodeBlob(clean.blob), dry=cleanBuffer.getChannelData(0);
  const samples: {name:string;blob:Blob}[]=[];
  for(const effect of ['clean','warm','tape','lofi','glitch','reverse','pitch','space','destroy'] as EffectId[]){
    const bypass=await decodeBlob((await renderDraft({...fixture,effect,effectMix:0})).blob);
    assert(bypass.length===cleanBuffer.length,`${effect}: bypass duration`);
    assert(bypass.getChannelData(0).every((x,i)=>x===dry[i]),`${effect}: bypass samples differ`);
    const rendered=await renderDraft({...fixture,effect,effectMix:100});
    const decoded=await decodeBlob(rendered.blob);
    const data=decoded.getChannelData(0);
    assert(decoded.numberOfChannels===2,`${effect}: stereo lost`);
    assert(data.every(Number.isFinite),`${effect}: invalid samples`);
    let peak=0,energy=0,difference=0;
    for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]*data[i];if(i<dry.length)difference+=(data[i]-dry[i])**2;}
    assert(peak<.999,`${effect}: clipping`);assert(energy>.001,`${effect}: silent output`);
    assert(effect==='clean'||difference>.001,`${effect}: indistinguishable from clean`);
    assert(Math.abs(rendered.duration-(clean.duration+(effect==='space'?2.8:0)))<1/decoded.sampleRate,`${effect}: unexpected duration`);
    if(effect==='space'){
      assert(data.slice(dry.length).some(x=>Math.abs(x)>.0001),'Space tail missing');
      assert(Math.abs(data[data.length-1])<.0001,'Space tail cut');
      const repeat=await decodeBlob((await renderDraft({...fixture,effect,effectMix:100})).blob);
      assert(repeat.getChannelData(0).every((x,i)=>x===data[i]),'Space render is not repeatable');
    }
    samples.push({name:effect,blob:rendered.blob});
    report(`PASS ${effect.toUpperCase()} · ${rendered.duration.toFixed(3)}s · peak ${peak.toFixed(3)} · dry bypass exact`);
  }
  const faded=await decodeBlob((await renderDraft({...fixture,fadeIn:true,fadeOut:true})).blob);
  assert(faded.getChannelData(0)[0]===0 && faded.getChannelData(0).at(-1)===0,'Fade endpoints');
  let rejected=false;
  try{await renderDraft({...fixture,trimStart:1,trimEnd:.5});}catch{rejected=true;}
  assert(rejected,'Invalid trim accepted');
  const name=`field-isolated-qa-${crypto.randomUUID()}`, repository=createSoundRepository(name);
  const record={id:'disposable-fixture',title:'Test',emojis:[],styleId:'grotesk',duration:clean.duration,createdAt:0,favorite:false,visibility:'private' as const,audioBlob:clean.blob,waveform:clean.waveform};
  await repository.save(record);
  const restored=(await createSoundRepository(name).getAll())[0];
  assert(restored.audioBlob.size===clean.blob.size,'Blob persistence after DB reopen');
  await repository.save({...restored,title:'Renamed',favorite:true});
  const edited=(await repository.getAll())[0];
  assert(edited.title==='Renamed' && edited.favorite,'Rename/favorite persistence');
  await repository.remove(record.id);
  assert((await repository.getAll()).length===0,'Blob deletion');
  indexedDB.deleteDatabase(name);
  report('PASS isolated IndexedDB · save / reopen / rename / favorite / delete');
  report(`COMPLETE — ${checks} assertions passed`);
  return samples;
}
