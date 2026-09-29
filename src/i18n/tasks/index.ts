import type { Task } from "../../data/tasks";
import type { Locale } from "..";
import en from "./en.json";
import hy from "./hy.json";
import zhTW from "./zh-TW.json";

export type TaskCopy = Pick<
  Task,
  "todayLabel" | "handwrittenLabel" | "instruction"
>;

const translations: Record<Exclude<Locale, "ru">, Record<string, TaskCopy>> = {
  en,
  hy,
  "zh-TW": zhTW,
};

// Localize only the copy: task identity, rotation and artwork stay unchanged.
export function getTaskCopy(task: Task, locale: Locale): TaskCopy {
  if (locale === "ru") return task;
  return translations[locale]?.[task.id] ?? translations.en[task.id] ?? task;
}
