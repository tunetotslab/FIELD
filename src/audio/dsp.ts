/** Deterministic, sample-domain audio processors, independent of React. */
export function stutter(input: Float32Array, sampleRate: number) {
  const output = input.slice(), beat = Math.max(1, Math.round(sampleRate * .24)), slice = Math.max(1, Math.round(beat / 4)), crossfade = Math.max(1, Math.round(sampleRate * .004));
  for (let i = 0; i < output.length; i++) {
    const block = Math.floor(i / beat), local = i % beat;
    if (block % 4 === 0) continue;
    const repeat = local % slice, source = Math.min(block * beat + repeat, input.length - 1);
    let value = input[source];
    if (repeat < crossfade && local >= slice) {
      const previous = Math.min(block * beat + slice + repeat, input.length - 1), blend = .5 - .5 * Math.cos(Math.PI * repeat / crossfade);
      value = input[previous] * (1 - blend) + value * blend;
    }
    const edge = Math.min(local / crossfade, (beat - local) / crossfade, 1);
    output[i] = input[i] * (1 - edge) + value * edge;
  }
  return output;
}

export function degrade(input: Float32Array, sampleRate: number, extreme = false) {
  const output = new Float32Array(input.length), hold = Math.max(1, Math.round(sampleRate / (extreme ? 5800 : 12500))), steps = extreme ? 31 : 255;
  let held = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % hold === 0) held = Math.round(input[i] * steps) / steps;
    output[i] = held;
  }
  return output;
}

export function finishSamples(channels: Float32Array[], sampleRate: number, fadeIn: boolean, fadeOut: boolean, hasTail: boolean) {
  const length = channels[0]?.length || 0;
  const entrance = fadeIn ? Math.min(Math.round(sampleRate * .6), Math.floor(length / 3)) : 0;
  const exit = fadeOut ? Math.min(Math.round(sampleRate * .8), Math.floor(length / 3)) : hasTail ? Math.min(length, Math.round(sampleRate * .03)) : 0;
  let peak = 0;
  for (const data of channels) for (let i = 0; i < length; i++) {
    if (!Number.isFinite(data[i])) throw new Error('Audio processing produced an invalid sample.');
    const gainIn = entrance && i < entrance ? Math.sin(i / entrance * Math.PI / 2) ** 2 : 1, remaining = length - 1 - i;
    const gainOut = exit && remaining < exit ? Math.sin(remaining / exit * Math.PI / 2) ** 2 : 1;
    data[i] *= gainIn * gainOut; peak = Math.max(peak, Math.abs(data[i]));
  }
  // Linked-channel peak protection. Never boosts quiet recordings.
  const attenuation = peak > .98 ? .98 / peak : 1;
  if (attenuation !== 1) for (const data of channels) for (let i = 0; i < length; i++) data[i] *= attenuation;
  return attenuation;
}
