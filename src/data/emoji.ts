import english from "emojibase-data/en/compact.json";
import russian from "emojibase-data/ru/compact.json";
import traditionalChinese from "emojibase-data/zh-hant/compact.json";
import type { Locale } from "../i18n";

type EmojiEntry = {
  group?: number;
  hexcode: string;
  label: string;
  order?: number;
  tags?: string[];
  unicode: string;
};
export type EmojiCategory =
  | "smileys"
  | "people"
  | "nature"
  | "food"
  | "travel"
  | "activities"
  | "objects"
  | "symbols"
  | "flags";

const categoryDefinitions: Array<{
  id: EmojiCategory;
  group: number;
  icon: string;
  label: string;
}> = [
  { id: "smileys", group: 0, icon: "😀", label: "Smileys & Emotion" },
  { id: "people", group: 1, icon: "🧑", label: "People & Body" },
  { id: "nature", group: 3, icon: "🐻", label: "Animals & Nature" },
  { id: "food", group: 4, icon: "🍕", label: "Food & Drink" },
  { id: "travel", group: 5, icon: "🚗", label: "Travel & Places" },
  { id: "activities", group: 6, icon: "⚽", label: "Activities" },
  { id: "objects", group: 7, icon: "💡", label: "Objects" },
  { id: "symbols", group: 8, icon: "❤️", label: "Symbols" },
  { id: "flags", group: 9, icon: "🏳️", label: "Flags" },
];

const englishEntries = english as EmojiEntry[];
const byHexcode = (entries: EmojiEntry[]) =>
  new Map(entries.map((entry) => [entry.hexcode, entry]));
const localized = {
  en: byHexcode(englishEntries),
  ru: byHexcode(russian as EmojiEntry[]),
  "zh-TW": byHexcode(traditionalChinese as EmojiEntry[]),
};

export const emojiCategories = categoryDefinitions.map((category) => ({
  ...category,
  items: [
    ...new Set(
      englishEntries
        .filter((entry) => entry.group === category.group)
        .map((entry) => entry.unicode),
    ),
  ],
}));

const supplementalKeywords: Partial<Record<Locale, Record<string, string[]>>> =
  {
    hy: {
      շուն: ["🐶", "🐕", "🦮", "🐕‍🦺"],
      կատու: ["🐱", "🐈", "🐈‍⬛"],
      կենդանի: ["🐶", "🐱", "🐻", "🦊", "🐦"],
      երաժշտություն: ["🎵", "🎶", "🎧", "🎤", "🎸", "🎹", "🥁"],
      ձայն: ["🔊", "🎵", "🎙️", "🎧"],
      ծառ: ["🌳", "🌲", "🌴"],
      անտառ: ["🌲", "🌳", "🍄"],
      բնություն: ["🌿", "🌳", "🌲", "🌸", "🏔️"],
      անձրև: ["🌧️", "☔", "💧"],
      ջուր: ["💧", "🌊"],
      կրակ: ["🔥"],
      արև: ["☀️", "🌞"],
      լուսին: ["🌙", "🌕"],
      սեր: ["❤️", "🩷", "💕"],
      տուն: ["🏠", "🏡"],
      մեքենա: ["🚗", "🚙"],
      գնացք: ["🚂", "🚆"],
      ուտելիք: ["🍎", "🍕", "🍜"],
      սուրճ: ["☕"],
      գիրք: ["📚"],
      լույս: ["💡", "🔦"],
      հայաստան: ["🇦🇲"],
      երևան: ["🇦🇲"],
      ուրախ: ["😀", "😃", "😊"],
      տխուր: ["😢", "😭"],
    },
    "zh-TW": {
      狗: ["🐶", "🐕", "🦮", "🐕‍🦺"],
      音樂: ["🎵", "🎶", "🎧", "🎤", "🎸", "🎹"],
      森林: ["🌲", "🌳", "🍄"],
      下雨: ["🌧️", "☔", "💧"],
      雨: ["🌧️", "☔", "💧"],
      亞美尼亞: ["🇦🇲"],
    },
  };

const normalize = (value: string, locale?: string) =>
  value.toLocaleLowerCase(locale).normalize("NFKD").trim();

export function searchEmoji(query: string, locale: Locale = "en") {
  const words = normalize(query, locale).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const result: string[] = [];
  const add = (emoji: string) => {
    if (!result.includes(emoji)) result.push(emoji);
  };

  const supplemental = supplementalKeywords[locale];
  if (supplemental) {
    for (const word of words) {
      for (const [keyword, emojis] of Object.entries(supplemental)) {
        const normalizedKeyword = normalize(keyword, locale);
        if (
          normalizedKeyword.includes(word) ||
          word.includes(normalizedKeyword)
        )
          emojis.forEach(add);
      }
    }
  }

  const localeIndex =
    locale === "ru"
      ? localized.ru
      : locale === "zh-TW"
        ? localized["zh-TW"]
        : localized.en;
  for (const entry of englishEntries) {
    const translated = localeIndex.get(entry.hexcode);
    const searchable = [
      translated?.label,
      ...(translated?.tags ?? []),
      entry.label,
      ...(entry.tags ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value), locale));
    if (words.every((word) => searchable.some((value) => value.includes(word))))
      add(entry.unicode);
  }
  return result;
}
