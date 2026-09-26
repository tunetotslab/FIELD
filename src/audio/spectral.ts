/** Radix-2 FFT, in-place; inverse transform includes 1/N normalization. */
function fft(real: Float64Array, imag: Float64Array, inverse = false) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i],real[j]]=[real[j],real[i]]; [imag[i],imag[j]]=[imag[j],imag[i]]; }
  }
  for (let length = 2; length <= n; length *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / length, wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let ar = 1, ai = 0;
      for (let j = 0; j < length / 2; j++) {
        const a = start + j, b = a + length / 2;
        const br = real[b] * ar - imag[b] * ai, bi = real[b] * ai + imag[b] * ar;
        real[b] = real[a] - br; imag[b] = imag[a] - bi; real[a] += br; imag[a] += bi;
        const next = ar * wr - ai * wi; ai = ar * wi + ai * wr; ar = next;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {real[i] /= n; imag[i] /= n;}
}

/** Phase-locked phase vocoder + windowed-sinc resampling; preserves clip length. */
export function spectralPitch(input: Float32Array, sampleRate: number, semitones: number) {
  if (!semitones || input.length < 2) return input.slice();
  const ratio = 2 ** (semitones / 12), n = sampleRate >= 32000 ? 2048 : 1024, hop = n / 8, bins = n / 2 + 1;
  const length = Math.ceil(input.length * ratio) + n * 2;
  const stretched = new Float64Array(length), weights = new Float64Array(length);
  const previous = new Float64Array(bins), accumulated = new Float64Array(bins);
  const real = new Float64Array(n), imag = new Float64Array(n), magnitude = new Float64Array(bins), phase = new Float64Array(bins);
  const window = Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n));
  let first = true, lastDestination = 0;
  for (let center = -n; center < input.length + n; center += hop) {
    const destination = Math.round(center * ratio), synthesisHop = destination - lastDestination;
    for (let i = 0; i < n; i++) {
      const index = center + i - n / 2;
      real[i] = (index >= 0 && index < input.length ? input[index] : 0) * window[i]; imag[i] = 0;
    }
    fft(real,imag);
    for (let k = 0; k < bins; k++) {
      magnitude[k] = Math.hypot(real[k],imag[k]); phase[k] = Math.atan2(imag[k],real[k]);
      const omega = 2 * Math.PI * k / n;
      let delta = phase[k] - previous[k] - omega * hop;
      delta -= 2 * Math.PI * Math.round(delta / (2 * Math.PI));
      accumulated[k] = first ? phase[k] : accumulated[k] + (omega + delta / hop) * synthesisHop;
      previous[k] = phase[k];
    }
    // Lock neighboring bins to spectral peaks to preserve coherent transients/partials.
    const peaks: number[] = [];
    for (let k = 1; k < bins - 1; k++) if (magnitude[k] > magnitude[k-1] && magnitude[k] >= magnitude[k+1]) peaks.push(k);
    let peakIndex = 0;
    for (let k = 0; k < bins; k++) {
      while (peakIndex + 1 < peaks.length && Math.abs(peaks[peakIndex+1]-k) < Math.abs(peaks[peakIndex]-k)) peakIndex++;
      const peak = peaks[peakIndex] ?? k;
      const angle = accumulated[peak] + phase[k] - phase[peak];
      real[k] = magnitude[k] * Math.cos(angle); imag[k] = magnitude[k] * Math.sin(angle);
      if (k > 0 && k < n / 2) {real[n-k] = real[k]; imag[n-k] = -imag[k];}
    }
    imag[0]=0; imag[n/2]=0;
    fft(real,imag,true);
    for (let i = 0; i < n; i++) {
      const target = destination + i - n / 2;
      if (target < 0 || target >= length) continue;
      stretched[target] += real[i] * window[i]; weights[target] += window[i] ** 2;
    }
    first = false; lastDestination = destination;
  }
  for (let i = 0; i < length; i++) stretched[i] /= Math.max(weights[i], 1e-8);
  const result = new Float32Array(input.length), cutoff = Math.min(1,1/ratio);
  for (let i = 0; i < result.length; i++) {
    const position = i * ratio, base = Math.floor(position);
    let sample = 0, weight = 0;
    for (let tap = -16; tap <= 16; tap++) {
      const index = base + tap, distance = index - position, x = Math.PI * distance * cutoff;
      const kernel = (Math.abs(x) < 1e-8 ? 1 : Math.sin(x)/x) * (.5+.5*Math.cos(Math.PI*distance/17)) * cutoff;
      if (index >= 0 && index < length) sample += stretched[index] * kernel;
      weight += kernel;
    }
    result[i] = sample / Math.max(weight, 1e-8);
  }
  return result;
}
