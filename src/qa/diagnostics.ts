import { renderDraft } from "../audio/processing";
import { decodeBlob } from "../audio/utils";
import type { EffectId, SoundDraft } from "../types";
import { createSoundRepository } from "../storage/db";
import {
  EMOJI_COMPATIBILITY_VERSION,
  emojiCategories,
  searchEmoji,
} from "../data/emoji";
export async function runAudioChecks(
  fixture: SoundDraft,
  report: (line: string) => void,
) {
  let checks = 0;
  const assert = (condition: boolean, label: string) => {
    if (!condition) throw new Error(label);
    checks++;
  };
  const emojiCount = new Set(
    emojiCategories.flatMap((category) => category.items),
  ).size;
  assert(emojiCategories.length === 9, "Emoji categories incomplete");
  assert(emojiCount > 1500, `Emoji catalogue too small: ${emojiCount}`);
  const allEmoji = emojiCategories.flatMap((category) => category.items);
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  assert(
    allEmoji.every(
      (emoji) => [...segmenter.segment(emoji)].length === 1 && !emoji.includes("�"),
    ),
    "Emoji catalogue contains a broken Unicode sequence",
  );
  for (const unsupported of ["🫩", "🫪", "🫯", "🫈", "🫆", "🪾", "🪉"])
    assert(!allEmoji.includes(unsupported), `Unsupported emoji leaked: ${unsupported}`);
  for (const [query, locale, expected] of [
    ["dog", "en", "🐶"],
    ["music", "en", "🎵"],
    ["forest", "en", "🌲"],
    ["rain", "en", "🌧️"],
    ["Armenia", "en", "🇦🇲"],
    ["собака", "ru", "🐶"],
    ["музыка", "ru", "🎵"],
    ["лес", "ru", "🌲"],
    ["дождь", "ru", "🌧️"],
    ["շուն", "hy", "🐶"],
    ["երաժշտություն", "hy", "🎵"],
    ["անտառ", "hy", "🌲"],
    ["անձրև", "hy", "🌧️"],
    ["狗", "zh-TW", "🐶"],
    ["音樂", "zh-TW", "🎵"],
    ["森林", "zh-TW", "🌲"],
    ["下雨", "zh-TW", "🌧️"],
  ] as const)
    assert(
      searchEmoji(query, locale).includes(expected),
      `Emoji search ${locale}: ${query}`,
    );
  report(
    `PASS emoji catalogue · ${emojiCount} Unicode entries · compatibility ≤ ${EMOJI_COMPATIBILITY_VERSION} · EN/RU/HY/ZH-TW search`,
  );
  const clean = await renderDraft({ ...fixture, effect: "original" });
  const cleanBuffer = await decodeBlob(clean.blob),
    dry = cleanBuffer.getChannelData(0);
  const samples: { name: string; blob: Blob }[] = [];
  for (const effect of [
    "original",
    "echo",
    "resonator",
    "tapeStop",
    "chorus",
    "flanger",
    "lofi",
    "glitch",
    "reverse",
    "pitch",
    "space",
    "destroy",
  ] as EffectId[]) {
    const bypass = await decodeBlob(
      (await renderDraft({ ...fixture, effect, effectMix: 0 })).blob,
    );
    assert(bypass.length === cleanBuffer.length, `${effect}: bypass duration`);
    assert(
      bypass.getChannelData(0).every((x, i) => x === dry[i]),
      `${effect}: bypass samples differ`,
    );
    const rendered = await renderDraft({ ...fixture, effect, effectMix: 100 });
    const decoded = await decodeBlob(rendered.blob);
    const data = decoded.getChannelData(0);
    assert(decoded.numberOfChannels === 2, `${effect}: stereo lost`);
    assert(data.every(Number.isFinite), `${effect}: invalid samples`);
    let peak = 0,
      energy = 0,
      difference = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
      energy += data[i] * data[i];
      if (i < dry.length) difference += (data[i] - dry[i]) ** 2;
    }
    assert(peak < 0.999, `${effect}: clipping`);
    assert(energy > 0.001, `${effect}: silent output`);
    assert(
      effect === "original" || difference > 0.001,
      `${effect}: indistinguishable from original`,
    );
    if (effect === "chorus") {
      const right = decoded.getChannelData(1);
      let stereoDifference = 0;
      for (let index = 0; index < data.length; index++)
        stereoDifference += (data[index] - right[index]) ** 2;
      assert(stereoDifference > 0.001, "Chorus stereo width missing");
    }
    const tail =
      effect === "space"
        ? 2.8
        : effect === "echo"
          ? Math.min(3.2, Math.max(0.8, (fixture.echoDelayMs / 1000) * 4))
          : 0;
    assert(
      Math.abs(rendered.duration - (clean.duration + tail)) <
        2 / decoded.sampleRate,
      `${effect}: unexpected duration`,
    );
    if (effect === "space") {
      assert(
        data.slice(dry.length).some((x) => Math.abs(x) > 0.0001),
        "Space tail missing",
      );
      assert(Math.abs(data[data.length - 1]) < 0.0001, "Space tail cut");
      const repeat = await decodeBlob(
        (await renderDraft({ ...fixture, effect, effectMix: 100 })).blob,
      );
      assert(
        repeat.getChannelData(0).every((x, i) => x === data[i]),
        "Space render is not repeatable",
      );
    }
    samples.push({ name: effect, blob: rendered.blob });
    report(
      `PASS ${effect.toUpperCase()} · ${rendered.duration.toFixed(3)}s · peak ${peak.toFixed(3)} · dry bypass exact`,
    );
  }
  const faded = await decodeBlob(
    (await renderDraft({ ...fixture, fadeIn: true, fadeOut: true })).blob,
  );
  assert(
    faded.getChannelData(0)[0] === 0 && faded.getChannelData(0).at(-1) === 0,
    "Fade endpoints",
  );
  let rejected = false;
  try {
    await renderDraft({ ...fixture, trimStart: 1, trimEnd: 0.5 });
  } catch {
    rejected = true;
  }
  assert(rejected, "Invalid trim accepted");
  const trimmed = await renderDraft({
    ...fixture,
    effect: "original",
    trimStart: 0.5,
    trimEnd: 1.25,
  });
  assert(
    Math.abs(trimmed.duration - 0.75) < 1 / 48000,
    "Trim duration not applied",
  );
  const fastEcho = await renderDraft({
    ...fixture,
    effect: "echo",
    effectMix: 100,
    echoDelayMs: 80,
  });
  const slowEcho = await renderDraft({
    ...fixture,
    effect: "echo",
    effectMix: 100,
    echoDelayMs: 900,
  });
  assert(
    slowEcho.duration > fastEcho.duration + 2,
    "Echo delay parameter not applied",
  );
  report(
    "PASS trim 0.50–1.25s → 0.75s · Echo rate changes rendered repeat spacing/tail",
  );
  const name = `field-isolated-qa-${crypto.randomUUID()}`,
    repository = createSoundRepository(name);
  const record = {
    id: "disposable-fixture",
    title: "Test",
    emojis: [],
    styleId: "grotesk",
    duration: clean.duration,
    createdAt: 0,
    favorite: false,
    visibility: "private" as const,
    audioBlob: clean.blob,
    waveform: clean.waveform,
  };
  await repository.save(record);
  const restored = (await createSoundRepository(name).getAll())[0];
  assert(
    restored.audioBlob.size === clean.blob.size,
    "Blob persistence after DB reopen",
  );
  await repository.save({ ...restored, title: "Renamed", favorite: true });
  const edited = (await repository.getAll())[0];
  assert(
    edited.title === "Renamed" && edited.favorite,
    "Rename/favorite persistence",
  );
  await repository.remove(record.id);
  assert((await repository.getAll()).length === 0, "Blob deletion");
  indexedDB.deleteDatabase(name);
  report(
    "PASS isolated IndexedDB · save / reopen / rename / favorite / delete",
  );
  report(`COMPLETE — ${checks} assertions passed`);
  return samples;
}
