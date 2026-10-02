import type { EffectId, SoundDraft } from "../types";
import { audioBufferToWav, decodeBlob, peaksFromBuffer } from "./utils";
import { degrade, finishSamples, loFi, stutter, tapeStop } from "./dsp";
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

function resonatorImpulse(context: BaseAudioContext) {
  const duration = 0.9;
  const impulse = context.createBuffer(
    2,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const modes = [
    [146.83, 0.72, 1, 0],
    [220, 0.62, 0.78, -0.68],
    [293.66, 0.56, 0.7, 0.68],
    [440, 0.46, 0.56, -0.38],
    [587.33, 0.39, 0.46, 0.38],
  ] as const;
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (const [frequency, decay, level, pan] of modes) {
      const damping = Math.exp(-1 / (decay * context.sampleRate));
      const channelLevel =
        channel === 0
          ? Math.cos(((pan + 1) * Math.PI) / 4)
          : Math.sin(((pan + 1) * Math.PI) / 4);
      for (let i = 0; i < data.length; i++)
        data[i] +=
          2 *
          (1 - damping) *
          level *
          channelLevel *
          Math.sin((2 * Math.PI * frequency * i) / context.sampleRate) *
          damping ** i;
    }
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
  if(draft.effectChain) {
    if(draft.effectChain.length>3) throw Error('Maximum three effects');
    const slots=draft.effectChain.filter(slot=>!slot.bypassed && slot.effect!=='original');
    let source=draft.originalBlob;
    let start=draft.trimStart,end=draft.trimEnd;
    let result;
    for(let index=0;index<Math.max(1,slots.length);index++) {
      if(signal?.aborted) throw new DOMException('Preview cancelled','AbortError');
      const slot=slots[index];
      result=await renderSingle({...draft,effectChain:undefined,originalBlob:source,trimStart:start,trimEnd:end,effect:slot?.effect||'original',effectMix:slot?.mix||0,pitchSemitones:slot?.pitchSemitones||0,echoDelayMs:slot?.echoDelayMs||340,fadeIn:index===Math.max(1,slots.length)-1 && draft.fadeIn,fadeOut:index===Math.max(1,slots.length)-1 && draft.fadeOut},signal);
      source=result.blob;start=0;end=result.duration;
    }
    return result!;
  }
  return renderSingle(draft,signal);
}

async function renderSingle(draft:SoundDraft,signal?:AbortSignal):Promise<{blob:Blob;waveform:number[];duration:number}> {
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
      mix > 0
        ? effect === "space"
          ? 2.8
          : effect === "echo"
            ? Math.min(
                3.2,
                Math.max(0.8, ((draft.echoDelayMs || 340) / 1000) * 4),
              )
            : effect === "resonator"
              ? 0.9
              : 0
        : 0,
    frameCount = end - start;
  const outputChannels =
    tailSeconds > 0 || effect === "chorus" || effect === "flanger"
      ? Math.max(2, original.numberOfChannels)
      : original.numberOfChannels;
  const context = new OfflineAudioContext(
    outputChannels,
    Math.min(Math.round(60*sampleRate),frameCount + Math.ceil(tailSeconds * sampleRate)),
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
                : effect === "lofi"
                  ? loFi(samples, sampleRate, channel)
                  : effect === "destroy"
                    ? degrade(samples, sampleRate, true)
                  : samples;
    wetBuffer.getChannelData(channel).set(wetSamples);
  }
  const drySource = context.createBufferSource();
  drySource.buffer = dryBuffer;
  const wetSource = context.createBufferSource();
  wetSource.buffer = wetBuffer;
  const dryGain = context.createGain();
  dryGain.gain.value = Math.cos((mix * Math.PI) / 2);
  const wetGain = context.createGain();
  wetGain.gain.value = Math.sin((mix * Math.PI) / 2);
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
    delay.delayTime.value = Math.max(
      0.08,
      Math.min(1, (draft.echoDelayMs || 340) / 1000),
    );
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
    const inputFilter = context.createBiquadFilter();
    inputFilter.type = "highpass";
    inputFilter.frequency.value = 105;
    const body = context.createConvolver();
    body.normalize = false;
    body.buffer = resonatorImpulse(context);
    const bodyGain = context.createGain();
    bodyGain.gain.value = 13;
    node.connect(inputFilter).connect(body).connect(bodyGain).connect(wetGain);
    wetConnected = true;
  } else if (effect === "chorus") {
    const chorusBus = context.createGain();
    chorusBus.gain.value = 1.18;
    const center = context.createGain();
    center.gain.value = 0.12;
    node.connect(center).connect(chorusBus);
    const voices: Array<[number, number, number, number]> = [
      [0.011, 0.0042, 0.34, -0.88],
      [0.018, -0.0051, 0.43, 0.88],
      [0.026, 0.0058, 0.27, -0.44],
      [0.034, -0.0064, 0.52, 0.44],
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
      const voiceLevel = context.createGain();
      voiceLevel.gain.value = 0.36;
      lfo.connect(modulation).connect(delay.delayTime);
      node.connect(delay).connect(voiceLevel).connect(position).connect(chorusBus);
      lfo.start(0);
    }
    const air = context.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 5200;
    air.gain.value = -1.2;
    chorusBus.connect(air).connect(wetGain);
    wetConnected = true;
  } else if (effect === "flanger") {
    const flangerBus = context.createGain();
    flangerBus.gain.value = 1.08;
    const direct = context.createGain();
    direct.gain.value = 0.58;
    node.connect(direct).connect(flangerBus);
    for (const [rate, depth, pan, polarity] of [
      [0.31, 0.0044, -0.8, 1],
      [0.39, -0.004, 0.8, -1],
    ] as const) {
      const delay = context.createDelay(0.012);
      delay.delayTime.value = 0.0052;
      const lfo = context.createOscillator();
      lfo.frequency.value = rate;
      const modulation = context.createGain();
      modulation.gain.value = depth;
      const feedback = context.createGain();
      feedback.gain.value = 0.7 * polarity;
      const safeBass = context.createBiquadFilter();
      safeBass.type = "highpass";
      safeBass.frequency.value = 150;
      const damp = context.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 8200;
      const level = context.createGain();
      level.gain.value = 0.66;
      const position = context.createStereoPanner();
      position.pan.value = pan;
      lfo.connect(modulation).connect(delay.delayTime);
      node.connect(delay);
      delay.connect(safeBass).connect(damp).connect(feedback).connect(delay);
      delay.connect(level).connect(position).connect(flangerBus);
      lfo.start(0);
    }
    flangerBus.connect(wetGain);
    wetConnected = true;
  } else if (effect === "lofi") {
    filter("highpass", 145, 0, 0.65);
    filter("peaking", 1100, 2.2, 0.8);
    filter("lowpass", 5600, 0, 0.75);
    shape(1.8, 0.88);
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
