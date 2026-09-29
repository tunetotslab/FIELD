import type { Task } from "../data/tasks";
import type { Screen } from "../types";
import { Shell } from "./Shell";
import { useI18n } from "../i18n";
import { getTaskCopy } from "../i18n/tasks";

export function Daily({
  task,
  go,
  back,
}: {
  task: Task & { imageSrc: string };
  go: (s: Screen) => void;
  back: () => void;
}) {
  const { t, locale } = useI18n();
  const copy = getTaskCopy(task, locale);
  return (
    <Shell title={t("dailySound")} back={back}>
      <article className="daily-card" data-task-id={task.id} lang={locale}>
        <p className="daily-date">
          {t("todayTask")} {copy.todayLabel}
        </p>
        <h2 className="hand">{copy.handwrittenLabel}</h2>
        <figure className="daily-illustration">
          <img src={task.imageSrc} alt="" />
        </figure>
        <p>{copy.instruction}</p>
        <button className="primary-button" onClick={() => go("record")}>
          {t("recordNow")}
        </button>
      </article>
    </Shell>
  );
}
