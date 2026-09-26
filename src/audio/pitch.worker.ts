import { spectralPitch } from './spectral';

self.onmessage = (event: MessageEvent<{samples: Float32Array; sampleRate: number; semitones: number}>) => {
  try {
    const {samples,sampleRate,semitones}=event.data;
    const output=spectralPitch(samples,sampleRate,semitones);
    self.postMessage({output}, {transfer:[output.buffer]});
  } catch (error) { self.postMessage({error: error instanceof Error ? error.message : 'Pitch processing failed.'}); }
};
