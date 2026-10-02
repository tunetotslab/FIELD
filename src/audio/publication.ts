import type { SoundRecord } from "../types";
import { audioBufferToWav, decodeBlob, peaksFromBuffer } from "./utils";

/** Normalize the *public copy*, never replace or reapply FX to saved audio. */
export async function preparePublicationAudio(
  record: SoundRecord,
): Promise<SoundRecord> {
  const source = await decodeBlob(record.audioBlob);
  const length = Math.min(source.length, Math.round(source.sampleRate * 60));
  if (!length) throw Error("Empty saved audio");
  const audio = new AudioBuffer({
    length,
    numberOfChannels: Math.min(2, source.numberOfChannels),
    sampleRate: source.sampleRate,
  });
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = source.getChannelData(channel).slice(0, length);
    if (length < source.length) {
      const fade = Math.min(length, Math.round(source.sampleRate * 0.03));
      for (let index = 0; index < fade; index++)
        samples[length - 1 - index] *= index / fade;
    }
    audio.copyToChannel(samples, channel);
  }
  return {
    ...record,
    audioBlob: audioBufferToWav(audio),
    duration: audio.duration,
    waveform: peaksFromBuffer(audio),
  };
}
