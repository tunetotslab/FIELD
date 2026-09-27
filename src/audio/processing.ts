import type { EffectId, SoundDraft } from "../types";
import { audioBufferToWav, decodeBlob, peaksFromBuffer } from "./utils";
import { degrade, finishSamples, stutter, tapeStop } from "./dsp";
import { renderPitch } from "./pitch";

function saturation(drive: number) {
  const curve = new Float32Array(16385);
  for (let i = 0; i < curve.length; i++)
    curve[i] =
      Math.tanh(((2 * i) / (curve.length - 1) - 1) * drive) / Math.tanh(drive);
  return curve;
}

function roomImpulse(context: BaseAudioContext) {
  const impulse = context.createBuffer(
    2,
    Math.ceil(context.sampleRate * 2.6),
    context.sampleRate,
  );
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let seed = 947 + channel * 173,
      low = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      low += 0.24 * (seed / 0x80000000 - 1 - low);
      const time = i / context.sampleRate;
      data[i] = low * Math.exp(-time * 3.4) * Math.min(1, time / 0.025);
    }
    for (const [time, gain] of [
      [0.023, 0.8],
      [0.041, 0.56],
      [0.071, 0.39],
      [0.113, 0.27],
    ])
      data[Math.round((time + channel * 0.003) * context.sampleRate)] += gain;
  }
  return impulse;
}

export async function analyze(blob: Blob) {
  const buffer = await decodeBlob(blob);
  return { duration: buffer.duration, waveform: peaksFromBuffer(buffer) };
}

export async function renderDraft(
  draft: SoundDraft,
  signal?: AbortSignal,
): Promise<{ blob: Blob; waveform: number[]; duration: number }> {
  const original = await decodeBlob(draft.originalBlob),
    sampleRate = original.sampleRate;
  const start = Math.max(0, Math.round(draft.trimStart * sampleRate)),
    end = Math.min(original.length, Math.round(draft.trimEnd * sampleRate));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("Choose a non-empty trim region.");
  const effect = draft.effect,
    mix =
      effect === "original"
        ? 0
        : Math.max(0, Math.min(1, draft.effectMix / 100));
  const tailSeconds =
      mix > 0 ? (effect === "space" ? 2.8 : effect === "echo" ? 1.35 : 0) : 0,
    frameCount = end - start;
  const outputChannels =
    tailSeconds > 0 || effect === "chorus" || effect === "flanger"
      ? Math.max(2, original.numberOfChannels)
      : original.numberOfChannels;
  const context = new OfflineAudioContext(
    outputChannels,
    frameCount + Math.ceil(tailSeconds * sampleRate),
    sampleRate,
  );
  const dryBuffer = context.createBuffer(
      original.numberOfChannels,
      frameCount,
      sampleRate,
    ),
    wetBuffer = context.createBuffer(
      original.numberOfChannels,
      frameCount,
      sampleRate,
    );
  for (let channel = 0; channel < original.numberOfChannels; channel++) {
    const samples = original.getChannelData(channel).slice(start, end);
    dryBuffer.copyToChannel(samples, channel);
    if (signal?.aborted)
      throw new DOMException("Preview cancelled", "AbortError");
    const wetSamples =
      mix === 0
        ? samples
        : effect === "reverse"
          ? samples.slice().reverse()
          : effect === "pitch"
            ? await renderPitch(
                samples,
                sampleRate,
                Math.max(-12, Math.min(12, draft.pitchSemitones)),
                signal,
              )
            : effect === "tapeStop"
              ? tapeStop(samples, sampleRate)
              : effect === "glitch"
                ? stutter(samples, sampleRate)
                : effect === "lofi" || effect === "destroy"
                  ? degrade(samples, sampleRate, effect === "destroy")
                  : samples;
    wetBuffer.getChannelData(channel).set(wetSamples);
  }
  const drySource = context.createBufferSource();
  drySource.buffer = dryBuffer;
  const wetSource = context.createBufferSource();
  wetSource.buffer = wetBuffer;
  const dryGain = context.createGain();
  dryGain.gain.value = 1 - mix;
  const wetGain = context.createGain();
  wetGain.gain.value = mix;
  drySource.connect(dryGain).connect(context.destination);
  wetGain.connect(context.destination);
  let node: AudioNode = wetSource;
  function filter(
    type: BiquadFilterType,
    frequency: number,
    gain = 0,
    q = 0.707,
  ) {
    const next = context.createBiquadFilter();
    next.type = type;
    next.frequency.value = Math.min(frequency, sampleRate * 0.45);
    next.gain.value = gain;
    next.Q.value = q;
    node.connect(next);
    node = next;
  }
  function shape(drive: number, level: number) {
    const shaper = context.createWaveShaper();
    shaper.curve = saturation(drive);
    shaper.oversample = "4x";
    const output = context.createGain();
    output.gain.value = level;
    node.connect(shaper).connect(output);
    node = output;
  }
  let wetConnected = false;
  if (effect === "echo") {
    const delay = context.createDelay(1);
    delay.delayTime.value = 0.34;
    const feedback = context.createGain();
    feedback.gain.value = 0.34;
    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 4200;
    node.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    delay.connect(wetGain);
    wetConnected = true;
  } else if (effect === "resonator") {
    const sum = context.createGain();
    sum.gain.value = 2.4;
    for (const [frequency, q, gain] of [
      [196, 18, 0.75],
      [293.66, 22, 0.66],
      [440, 26, 0.55],
      [659.25, 30, 0.42],
    ] as const) {
      const resonator = context.createBiquadFilter();
      resonator.type = "bandpass";
      resonator.frequency.value = frequency;
      resonator.Q.value = q;
      const level = context.createGain();
      level.gain.value = gain;
      node.connect(resonator).connect(level).connect(sum);
    }
    sum.connect(wetGain);
    wetConnected = true;
  } else if (effect === "chorus") {
    const chorusBus = context.createGain();
    chorusBus.gain.value = 0.58;
    const voices: Array<[number, number, number, number]> = [
      [0.016, 0.0038, 0.29, -0.72],
      [0.023, -0.0046, 0.41, 0],
      [0.031, 0.0032, 0.53, 0.72],
    ];
    for (const [delaySeconds, depth, rate, pan] of voices) {
      const delay = context.createDelay(0.06);
      delay.delayTime.value = delaySeconds;
      const lfo = context.createOscillator();
      lfo.frequency.value = rate;
      const modulation = context.createGain();
      modulation.gain.value = depth;
      const position = context.createStereoPanner();
      position.pan.value = pan;
      lfo.connect(modulation).connect(delay.delayTime);
      node.connect(delay).connect(position).connect(chorusBus);
      lfo.start(0);
    }
    const air = context.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 3200;
    air.gain.value = -1.5;
    chorusBus.connect(air).connect(wetGain);
    wetConnected = true;
  } else if (effect === "flanger") {
    const delay = context.createDelay(0.02);
    delay.delayTime.value = 0.0032;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.24;
    const modulation = context.createGain();
    modulation.gain.value = 0.0026;
    const feedback = context.createGain();
    feedback.gain.value = 0.42;
    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 7200;
    const level = context.createGain();
    level.gain.value = 0.78;
    lfo.connect(modulation).connect(delay.delayTime);
    node.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    delay.connect(level).connect(wetGain);
    lfo.start(0);
    wetConnected = true;
  } else if (effect === "lofi") {
    filter("highpass", 220);
    filter("lowpass", 4200, 0, 0.9);
    shape(1.5, 0.85);
  } else if (effect === "destroy") {
    filter("highpass", 75);
    shape(12, 0.46);
    filter("peaking", 1250, 4, 0.8);
    filter("lowpass", 6200);
  } else if (effect === "space") {
    filter("highpass", 120);
    filter("lowpass", 7800);
    const room = context.createConvolver();
    room.buffer = roomImpulse(context);
    const roomGain = context.createGain();
    roomGain.gain.value = 0.85;
    node.connect(room).connect(roomGain).connect(wetGain);
    const delay = context.createDelay(0.8);
    delay.delayTime.value = 0.31;
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3100;
    const echoGain = context.createGain();
    echoGain.gain.value = 0.28;
    node.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    delay.connect(echoGain).connect(wetGain);
    wetConnected = true;
  }
  if (!wetConnected) node.connect(wetGain);
  drySource.start();
  wetSource.start();
  const rendered = await context.startRendering();
  const channels = Array.from(
    { length: rendered.numberOfChannels },
    (_, channel) => rendered.getChannelData(channel),
  );
  if (mix > 0 || draft.fadeIn || draft.fadeOut)
    finishSamples(
      channels,
      sampleRate,
      draft.fadeIn,
      draft.fadeOut,
      tailSeconds > 0,
    );
  return {
    blob: audioBufferToWav(rendered),
    waveform: peaksFromBuffer(rendered),
    duration: rendered.duration,
  };
}

export const effectLabel: Record<EffectId, string> = {
  original: "ORIGINAL",
  echo: "ECHO",
  resonator: "RESONATOR",
  tapeStop: "TAPE STOP",
  chorus: "CHORUS",
  flanger: "FLANGER",
  lofi: "LO-FI",
  glitch: "GLITCH",
  reverse: "REVERSE",
  pitch: "PITCH",
  space: "SPACE",
  destroy: "DESTROY",
};
