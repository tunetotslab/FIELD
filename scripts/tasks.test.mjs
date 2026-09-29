import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function load(path, replace = (text) => text) {
  const source = replace(
    await readFile(new URL(path, import.meta.url), "utf8"),
  );
  const { code } = await transformWithOxc(source, path);
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        code.replaceAll(
          '"react/jsx-runtime"',
          JSON.stringify(import.meta.resolve("react/jsx-runtime")),
        ),
      ).toString("base64")
  );
}
const { tasks } = await load("../src/data/tasks.ts");
const {
  createTaskSelector,
  createImageVariantSelector,
  localDate,
  TASK_ROTATION_KEY,
} = await load("../src/data/taskRotation.ts");
const { taskImages } = await load("../src/data/taskImages.ts", (text) =>
  text.replace(/import (\w+) from "([^"]+)";/g, 'const $1 = "$2";'),
);
assert.equal(tasks.length, 80);
assert.equal(new Set(tasks.map((task) => task.id)).size, 80);
for (let imageId = 1; imageId <= 20; imageId++) {
  assert.equal(tasks.filter((task) => task.imageId === imageId).length, 4);
  for (const path of taskImages[imageId]) {
    const png = await readFile(new URL("../src/data/" + path, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png[25], 6, "Original RGBA PNG preserved");
  }
}
assert.equal(Object.values(taskImages).flat().length, 23);
console.log(
  "PASS 80 unique tasks, four per image, 23 existing RGBA PNG assets",
);

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const ids = tasks.map((task) => task.id);
let previous;
for (let cycle = 0; cycle < 3; cycle++) {
  const seen = new Set();
  for (let visit = 0; visit < 80; visit++) {
    // Recreate selector every time to verify persistence across app restarts.
    const id = createTaskSelector(ids, storage)("per_visit");
    assert.notEqual(id, previous);
    assert.ok(!seen.has(id));
    seen.add(id);
    previous = id;
  }
}
console.log(
  "PASS three full shuffled cycles, restart persistence, no consecutive repeats",
);

for (const [year, month, day] of [
  [2026, 8, 29],
  [2026, 11, 31],
  [2028, 1, 29],
  [2026, 2, 8],
  [2026, 10, 1],
]) {
  const morning = new Date(year, month, day, 0, 1);
  const evening = new Date(year, month, day, 23, 59);
  const tomorrow = new Date(year, month, day + 1, 0, 1);
  const select = createTaskSelector(ids, storage);
  assert.equal(
    select("daily", morning),
    createTaskSelector(ids)("daily", evening),
  );
  assert.notEqual(select("daily", evening), select("daily", tomorrow));
  assert.equal(
    localDate(morning),
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
}
console.log(
  "PASS local calendar day stability, next day, year boundary, leap day and DST dates",
);

for (const imageId of [1, 9, 20]) {
  assert.deepEqual(
    Array.from({ length: 6 }, () =>
      createImageVariantSelector(storage)(imageId, 2, "per_visit"),
    ),
    [0, 1, 0, 1, 0, 1],
  );
}
const imageSelector = createImageVariantSelector(storage);
assert.equal(
  imageSelector(9, 2, "daily", new Date(2026, 8, 29, 1)),
  imageSelector(9, 2, "daily", new Date(2026, 8, 29, 23)),
);
const blocked = {
  getItem() {
    throw Error("blocked");
  },
  setItem() {
    throw Error("blocked");
  },
};
const fallback = createTaskSelector(ids, blocked);
assert.equal(
  new Set(Array.from({ length: 80 }, () => fallback("per_visit"))).size,
  80,
);
storage.setItem(TASK_ROTATION_KEY, "{broken json");
assert.ok(ids.includes(createTaskSelector(ids, storage)("per_visit")));
console.log(
  "PASS alternating artwork, stable daily artwork, blocked/corrupt storage",
);

// Render the real card repeatedly with the same selected task, using lightweight
// Shell/i18n wrappers so this test does not need the unrelated full application.
globalThis.__fieldTaskTest = { createElement };
try {
  const { Daily } = await load("../src/components/Daily.tsx", (text) =>
    text
      .replace(
        'import { Shell } from "./Shell";',
        'const Shell = ({ children }) => globalThis.__fieldTaskTest.createElement("main", null, children);',
      )
      .replace(
        'import { useI18n } from "../i18n";',
        "const useI18n = () => ({t: key => key});",
      )
      .replace(/^import type .*;$/gm, ""),
  );
  const task = { ...tasks[0], imageSrc: taskImages[1][0] };
  const props = { task, go() {}, back() {} };
  const before = storage.getItem(TASK_ROTATION_KEY);
  const html = renderToStaticMarkup(createElement(Daily, props));
  for (let i = 0; i < 5; i++)
    assert.equal(renderToStaticMarkup(createElement(Daily, props)), html);
  assert.ok(html.includes('data-task-id="task-01-01"'));
  assert.equal(storage.getItem(TASK_ROTATION_KEY), before);
  console.log(
    "PASS repeated real card renders preserve selected task, artwork and queue",
  );
} finally {
  delete globalThis.__fieldTaskTest;
}
