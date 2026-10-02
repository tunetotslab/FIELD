import type { SoundRecord } from "../types";
import { audioBufferToWav, decodeBlob, peaksFromBuffer } from "./utils";
import { normalizeRecording } from "../storage/normalize";
import { prepareSavedWav } from "./wav";
export class PublicationAudioError extends Error {
  constructor(
    message: string,
    public readonly step = "AUDIO_DECODE",
  ) {
    super(message);
  }
}

/** Normalize the *public copy*, never replace or reapply FX to saved audio. */
export async function preparePublicationAudio(
  record: SoundRecord,
): Promise<SoundRecord> {
  record = normalizeRecording(record);
  if (!(record.audioBlob instanceof Blob) || !record.audioBlob.size)
    throw new PublicationAudioError(
      "Saved audio is unavailable; the local record has been preserved",
      "AUDIO_MISSING",
    );
  try {
    const wav = prepareSavedWav(await record.audioBlob.arrayBuffer());
    if (wav)
      return {
        ...record,
        audioBlob: wav.blob,
        duration: wav.duration,
        waveform: wav.waveform,
      };
  } catch {
    throw new PublicationAudioError(
      "Saved WAV could not be read; the local record has been preserved",
      "AUDIO_WAV",
    );
  }
  let source: AudioBuffer;
  try {
    source = await decodeBlob(record.audioBlob);
  } catch {
    throw new PublicationAudioError(
      "Saved audio could not be decoded; the local record has been preserved",
    );
  }
  const length = Math.min(source.length, Math.round(source.sampleRate * 60));
  if (!length)
    throw new PublicationAudioError("Empty saved audio", "AUDIO_EMPTY");
  try {
    const numberOfChannels = Math.min(2, source.numberOfChannels);
    const channels: ReturnType<AudioBuffer["getChannelData"]>[] = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const samples = source.getChannelData(channel).slice(0, length);
      if (length < source.length) {
        const fade = Math.min(length, Math.round(source.sampleRate * 0.03));
        for (let index = 0; index < fade; index++)
          samples[length - 1 - index] *= index / fade;
      }
      channels.push(samples);
    }
    const audio = {
      length,
      numberOfChannels,
      sampleRate: source.sampleRate,
      duration: length / source.sampleRate,
      getChannelData: (channel: number) => channels[channel],
    };
    return {
      ...record,
      audioBlob: audioBufferToWav(audio),
      duration: audio.duration,
      waveform: peaksFromBuffer(audio),
    };
  } catch {
    throw new PublicationAudioError(
      "Audio conversion failed; the local record has been preserved",
      "AUDIO_CONVERT",
    );
  }
}
