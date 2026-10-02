export type PreparedWav = { blob: Blob; duration: number; waveform: number[] };

/** Saved renders are PCM WAV. Read their samples directly: no AudioContext,
 * AudioBuffer constructor or microphone/user-activation dependency on iOS. */
export function prepareSavedWav(
  bytes: ArrayBuffer,
  maximumSeconds = 60,
): PreparedWav | null {
  const view = new DataView(bytes);
  const text = (offset: number) =>
    String.fromCharCode(...new Uint8Array(bytes, offset, 4));
  if (bytes.byteLength < 12 || text(0) !== "RIFF" || text(8) !== "WAVE")
    return null;
  let channels = 0,
    rate = 0,
    dataStart = 0,
    dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const size = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + size > bytes.byteLength) throw Error("Truncated WAV");
    const kind = text(offset);
    if (kind === "fmt ") {
      if (size < 16) throw Error("Invalid WAV format");
      if (
        view.getUint16(start, true) !== 1 ||
        view.getUint16(start + 14, true) !== 16
      )
        return null;
      channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true);
      if (view.getUint16(start + 12, true) !== channels * 2)
        throw Error("Invalid sample alignment");
    } else if (kind === "data") {
      dataStart = start;
      dataSize = size;
    }
    offset = start + size + (size % 2);
  }
  if (channels !== 1 && channels !== 2) return null;
  if (!rate || !dataSize || dataSize % (channels * 2))
    throw Error("Empty or invalid WAV");
  const sourceFrames = dataSize / (channels * 2);
  const frames = Math.min(sourceFrames, Math.floor(rate * maximumSeconds));
  if (!frames) throw Error("Empty WAV");
  const size = frames * channels * 2;
  const output = new ArrayBuffer(44 + size),
    target = new DataView(output);
  const write = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      target.setUint8(offset + index, char.charCodeAt(0)),
    );
  write(0, "RIFF");
  target.setUint32(4, 36 + size, true);
  write(8, "WAVE");
  write(12, "fmt ");
  target.setUint32(16, 16, true);
  target.setUint16(20, 1, true);
  target.setUint16(22, channels, true);
  target.setUint32(24, rate, true);
  target.setUint32(28, rate * channels * 2, true);
  target.setUint16(32, channels * 2, true);
  target.setUint16(34, 16, true);
  write(36, "data");
  target.setUint32(40, size, true);
  const peaks = new Array<number>(160).fill(0),
    block = Math.max(1, Math.floor(frames / 160));
  const fade =
    frames < sourceFrames ? Math.min(frames, Math.round(rate * 0.03)) : 0;
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < channels; channel++) {
      let sample = view.getInt16(
        dataStart + (frame * channels + channel) * 2,
        true,
      );
      if (fade && frame >= frames - fade)
        sample = Math.round((sample * (frames - 1 - frame)) / fade);
      target.setInt16(44 + (frame * channels + channel) * 2, sample, true);
      if (channel === 0) {
        const bucket = Math.min(159, Math.floor(frame / block));
        peaks[bucket] = Math.max(peaks[bucket], Math.abs(sample) / 32768);
      }
    }
  const peak = Math.max(...peaks, 0.01);
  return {
    blob: new Blob([output], { type: "audio/wav" }),
    duration: frames / rate,
    waveform: peaks.map((value) => value / peak),
  };
}
