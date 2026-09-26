export function renderPitch(samples: Float32Array, sampleRate: number, semitones: number, signal?: AbortSignal): Promise<Float32Array> {
  if (!semitones) return Promise.resolve(samples);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./pitch.worker.ts',import.meta.url),{type:'module'});
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new DOMException('Preview cancelled','AbortError'));};
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=event=>{cleanup();event.data.error?reject(new Error(event.data.error)):resolve(event.data.output);};
    worker.onerror=()=>{cleanup();reject(new Error('Pitch processing failed. Try again.'));};
    worker.postMessage({samples,sampleRate,semitones},[samples.buffer]);
  });
}
