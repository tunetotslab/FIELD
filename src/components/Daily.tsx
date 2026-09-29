import type { Task } from "../data/tasks";
import type { Screen } from "../types";
import { Shell } from "./Shell";
import { useI18n } from "../i18n";

export function Daily({
  task,
  go,
  back,
}: {
  task: Task & { imageSrc: string };
  go: (s: Screen) => void;
  back: () => void;
}) {
  const { t } = useI18n();
  return (
    <Shell title={t("dailySound")} back={back}>
      <article className="daily-card" data-task-id={task.id}>
        <p className="daily-date" lang="ru">
          {t("todayTask")} {task.todayLabel}
        </p>
        <h2 className="hand" lang="ru">
          {task.handwrittenLabel}
        </h2>
        <figure className="daily-illustration">
          <img src={task.imageSrc} alt="" />
        </figure>
        <p lang="ru">{task.instruction}</p>
        <button className="primary-button" onClick={() => go("record")}>
          {t("recordNow")}
        </button>
      </article>
    </Shell>
  );
}
