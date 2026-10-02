export type TaskRotationMode = "per_visit" | "daily";
// Daily is intentionally stable for the whole local calendar day. Reopening the
// screen no longer advances the challenge or its artwork.
export const TASK_ROTATION_MODE: TaskRotationMode = "daily";
export const TASK_ROTATION_KEY = "field-task-rotation-v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Queue = { remaining: string[]; last?: string };

/** Tasks arrive in four-card artwork blocks. Interleave those blocks so every
 * calendar day changes both the prompt and its matching approved illustration. */
export function dailyTaskIds(tasks: readonly {id: string; imageId: number}[]): string[] {
  const groups = new Map<number, string[]>();
  for (const task of tasks) {
    const group = groups.get(task.imageId) || [];
    group.push(task.id);
    groups.set(task.imageId, group);
  }
  const result: string[] = [];
  const count = Math.max(...[...groups.values()].map(group => group.length));
  for (let index = 0; index < count; index++)
    for (const group of groups.values()) if (group[index]) result.push(group[index]);
  return result;
}

// Alternate the supplied artwork variants per image, independently of task order.
export function createImageVariantSelector(storage?: Storage) {
  const counts = new Map<number, number>();
  return (
    imageId: number,
    count: number,
    mode: TaskRotationMode,
    date = new Date(),
  ) => {
    if (mode === "daily") {
      const [year, month, day] = localDate(date).split("-").map(Number);
      return Math.floor(Date.UTC(year, month - 1, day) / 86400000) % count;
    }
    const key = `field-task-image-v1-${imageId}`;
    let next = counts.get(imageId) ?? 0;
    try {
      const saved = storage?.getItem(key);
      if (
        saved !== null &&
        saved !== undefined &&
        Number.isSafeInteger(Number(saved)) &&
        Number(saved) >= 0
      )
        next = Number(saved) % count;
    } catch {
      /* Memory fallback. */
    }
    counts.set(imageId, (next + 1) % count);
    try {
      storage?.setItem(key, String((next + 1) % count));
    } catch {
      /* Memory fallback. */
    }
    return next;
  };
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Call only on navigation, never from a React render or state initializer.
export function createTaskSelector(ids: readonly string[], storage?: Storage) {
  if (ids.length < 2 || new Set(ids).size !== ids.length)
    throw new Error("Task rotation requires at least two unique IDs");
  let memory: Queue = { remaining: [] };
  return (mode: TaskRotationMode, date = new Date()): string => {
    if (mode === "daily") {
      // Local calendar components, independent of timezone offsets and DST.
      // Deterministic across reloads, even if localStorage is unavailable.
      const [year, month, day] = localDate(date).split("-").map(Number);
      const ordinal = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
      return ids[((ordinal % ids.length) + ids.length) % ids.length];
    }
    let queue = memory;
    try {
      const saved = JSON.parse(storage?.getItem(TASK_ROTATION_KEY) ?? "null");
      if (
        saved &&
        Array.isArray(saved.remaining) &&
        saved.remaining.every(
          (id: unknown) => typeof id === "string" && ids.includes(id),
        ) &&
        new Set(saved.remaining).size === saved.remaining.length &&
        (saved.last === undefined || ids.includes(saved.last)) &&
        !saved.remaining.includes(saved.last)
      )
        queue = saved;
    } catch {
      /* Keep the in-memory queue when storage is blocked or corrupt. */
    }
    if (!queue.remaining.length) {
      queue = { remaining: [...ids], last: queue.last };
      for (let i = queue.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.remaining[i], queue.remaining[j]] = [
          queue.remaining[j],
          queue.remaining[i],
        ];
      }
      if (queue.remaining[0] === queue.last)
        [queue.remaining[0], queue.remaining[1]] = [
          queue.remaining[1],
          queue.remaining[0],
        ];
    }
    const selected = queue.remaining.shift()!;
    queue.last = selected;
    memory = queue;
    try {
      storage?.setItem(TASK_ROTATION_KEY, JSON.stringify(queue));
    } catch {
      /* Memory fallback. */
    }
    return selected;
  };
}
