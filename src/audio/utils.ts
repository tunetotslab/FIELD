export const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const context = new AudioContext();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      blob.arrayBuffer().then(bytes => context.decodeAudioData(bytes)),
      new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error('Audio decoding timed out; recorded bytes remain available')), 15000);}),
    ]);
  } finally {
    clearTimeout(timer);
    // Closing a stalled Safari context must not hold the UI forever either.
    void context.close().catch(() => {});
  }
}

export function peaksFromBuffer(buffer: AudioBuffer, count = 160): number[] {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / count));
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    let peak = 0;
    const start = i * block;
    for (let j = start; j < Math.min(data.length, start + block); j++) peak = Math.max(peak, Math.abs(data[j]));
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.01);
  return peaks.map(value => value / max);
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, length - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length - 44, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, data[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
