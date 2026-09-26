import type { EffectId, SoundDraft } from '../types';
import { audioBufferToWav, decodeBlob, peaksFromBuffer } from './utils';
import { degrade, finishSamples, stutter } from './dsp';
import { renderPitch } from './pitch';

function saturation(drive: number) {
  const curve = new Float32Array(16385);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((2 * i / (curve.length - 1) - 1) * drive) / Math.tanh(drive);
  return curve;
}

function roomImpulse(context: BaseAudioContext) {
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.6), context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let seed = 947 + channel * 173, low = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      low += .24 * (seed / 0x80000000 - 1 - low);
      const time = i / context.sampleRate;
      data[i] = low * Math.exp(-time * 3.4) * Math.min(1, time / .025);
    }
    for (const [time,gain] of [[.023,.8],[.041,.56],[.071,.39],[.113,.27]]) data[Math.round((time + channel * .003) * context.sampleRate)] += gain;
  }
  return impulse;
}

export async function analyze(blob: Blob) {
  const buffer = await decodeBlob(blob);
  return { duration: buffer.duration, waveform: peaksFromBuffer(buffer) };
}

export async function renderDraft(draft: SoundDraft, signal?: AbortSignal): Promise<{ blob: Blob; waveform: number[]; duration: number }> {
  const original = await decodeBlob(draft.originalBlob), sampleRate = original.sampleRate;
  const start = Math.max(0, Math.round(draft.trimStart * sampleRate)), end = Math.min(original.length, Math.round(draft.trimEnd * sampleRate));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Choose a non-empty trim region.');
  const effect = draft.effect, mix = effect === 'clean' ? 0 : Math.max(0, Math.min(1, draft.effectMix / 100));
  const tailSeconds = effect === 'space' && mix > 0 ? 2.8 : 0, frameCount = end - start;
  const outputChannels = tailSeconds > 0 ? Math.max(2, original.numberOfChannels) : original.numberOfChannels;
  const context = new OfflineAudioContext(outputChannels, frameCount + Math.ceil(tailSeconds * sampleRate), sampleRate);
  const dryBuffer = context.createBuffer(original.numberOfChannels, frameCount, sampleRate), wetBuffer = context.createBuffer(original.numberOfChannels, frameCount, sampleRate);
  for (let channel = 0; channel < original.numberOfChannels; channel++) {
    const samples = original.getChannelData(channel).slice(start, end);
    dryBuffer.copyToChannel(samples, channel);
    if(signal?.aborted) throw new DOMException('Preview cancelled','AbortError');
    const wetSamples = mix === 0 ? samples : effect === 'reverse' ? samples.slice().reverse()
      : effect === 'pitch' ? await renderPitch(samples, sampleRate, Math.max(-12, Math.min(12, draft.pitchSemitones)), signal)
      : effect === 'glitch' ? stutter(samples, sampleRate)
      : effect === 'lofi' || effect === 'destroy' ? degrade(samples, sampleRate, effect === 'destroy') : samples;
    wetBuffer.getChannelData(channel).set(wetSamples);
  }
  const drySource = context.createBufferSource(); drySource.buffer = dryBuffer;
  const wetSource = context.createBufferSource(); wetSource.buffer = wetBuffer;
  const dryGain = context.createGain(); dryGain.gain.value = 1 - mix;
  const wetGain = context.createGain(); wetGain.gain.value = mix;
  drySource.connect(dryGain).connect(context.destination); wetGain.connect(context.destination);
  let node: AudioNode = wetSource;
  function filter(type: BiquadFilterType, frequency: number, gain = 0, q = .707) {
    const next = context.createBiquadFilter(); next.type = type; next.frequency.value = Math.min(frequency, sampleRate * .45); next.gain.value = gain; next.Q.value = q;
    node.connect(next); node = next;
  }
  function shape(drive: number, level: number) {
    const shaper = context.createWaveShaper(); shaper.curve = saturation(drive); shaper.oversample = '4x';
    const output = context.createGain(); output.gain.value = level;
    node.connect(shaper).connect(output); node = output;
  }
  if (effect === 'warm') {
    filter('highpass', 28); filter('lowshelf', 180, 1.5); shape(1.7, .73); filter('highshelf', 5500, -1.6);
  } else if (effect === 'tape') {
    filter('highpass', 38); filter('lowshelf', 110, 1.7); shape(2.6, .64); filter('lowpass', 10500);
    const delay = context.createDelay(.03); delay.delayTime.value = .004;
    for (const [frequency,depth] of [[.47,.00065],[6.3,.000075]]) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = frequency; gain.gain.value = depth;
      oscillator.connect(gain).connect(delay.delayTime); oscillator.start(); oscillator.stop(context.length / sampleRate);
    }
    node.connect(delay); node = delay;
  } else if (effect === 'lofi') {
    filter('highpass', 220); filter('lowpass', 4200, 0, .9); shape(1.5, .85);
  } else if (effect === 'destroy') {
    filter('highpass', 75); shape(12, .46); filter('peaking', 1250, 4, .8); filter('lowpass', 6200);
  } else if (effect === 'space') {
    filter('highpass', 120); filter('lowpass', 7800);
    const room = context.createConvolver(); room.buffer = roomImpulse(context);
    const roomGain = context.createGain(); roomGain.gain.value = .85;
    node.connect(room).connect(roomGain).connect(wetGain);
    const delay = context.createDelay(.8); delay.delayTime.value = .31;
    const feedback = context.createGain(); feedback.gain.value = .32;
    const damp = context.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3100;
    const echoGain = context.createGain(); echoGain.gain.value = .28;
    node.connect(delay); delay.connect(damp).connect(feedback).connect(delay); delay.connect(echoGain).connect(wetGain);
  }
  if (effect !== 'space') node.connect(wetGain);
  drySource.start(); wetSource.start();
  const rendered = await context.startRendering();
  const channels = Array.from({length: rendered.numberOfChannels}, (_,channel) => rendered.getChannelData(channel));
  if (mix > 0 || draft.fadeIn || draft.fadeOut) finishSamples(channels, sampleRate, draft.fadeIn, draft.fadeOut, tailSeconds > 0);
  return { blob: audioBufferToWav(rendered), waveform: peaksFromBuffer(rendered), duration: rendered.duration };
}

export const effectLabel: Record<EffectId, string> = { clean: 'CLEAN', warm: 'WARM', tape: 'TAPE', lofi: 'LO-FI', glitch: 'GLITCH', reverse: 'REVERSE', pitch: 'PITCH', space: 'SPACE', destroy: 'DESTROY' };
