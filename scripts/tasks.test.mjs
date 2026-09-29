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
const taskTranslations = {};
for (const locale of ["en", "hy", "zh-TW"]) {
  const copy = JSON.parse(
    await readFile(
      new URL(`../src/i18n/tasks/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    Object.keys(copy).sort(),
    tasks.map((task) => task.id).sort(),
  );
  for (const task of tasks) {
    assert.deepEqual(Object.keys(copy[task.id]).sort(), [
      "handwrittenLabel",
      "instruction",
      "todayLabel",
    ]);
    for (const value of Object.values(copy[task.id])) {
      assert.ok(value.trim().length > 0);
      assert.ok(
        !/[А-Яа-яЁё]/u.test(value),
        `${locale}/${task.id} contains Russian`,
      );
    }
  }
  taskTranslations[locale] = copy;
}
globalThis.__fieldTaskTranslations = taskTranslations;
const { getTaskCopy } = await load("../src/i18n/tasks/index.ts", (text) =>
  text.replace(
    /import (\w+) from "\.\/(.*?)\.json";/g,
    (_, name, locale) =>
      `const ${name} = globalThis.__fieldTaskTranslations[${JSON.stringify(locale)}];`,
  ),
);
delete globalThis.__fieldTaskTranslations;
console.log(
  "PASS all 80 task IDs and three translated fields in en, hy and zh-TW",
);
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
globalThis.__fieldTaskTest = { createElement, getTaskCopy, locale: "ru" };
try {
  const { Daily } = await load("../src/components/Daily.tsx", (text) =>
    text
      .replace(
        'import { Shell } from "./Shell";',
        'const Shell = ({ children }) => globalThis.__fieldTaskTest.createElement("main", null, children);',
      )
      .replace(
        'import { useI18n } from "../i18n";',
        "const useI18n = () => ({t: key => key, locale: globalThis.__fieldTaskTest.locale});",
      )
      .replace(
        'import { getTaskCopy } from "../i18n/tasks";',
        "const { getTaskCopy } = globalThis.__fieldTaskTest;",
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
  for (const selected of tasks) {
    const props = {
      task: { ...selected, imageSrc: taskImages[selected.imageId][0] },
      go() {},
      back() {},
    };
    for (const locale of ["en", "hy", "zh-TW", "ru"]) {
      globalThis.__fieldTaskTest.locale = locale;
      const copy =
        locale === "ru" ? selected : taskTranslations[locale][selected.id];
      assert.equal(getTaskCopy(selected, locale).instruction, copy.instruction);
      const markup = renderToStaticMarkup(createElement(Daily, props));
      assert.ok(markup.includes(`lang="${locale}"`));
      assert.ok(markup.includes(`data-task-id="${selected.id}"`));
      assert.ok(markup.includes(`src="${props.task.imageSrc}"`));
      for (const field of ["todayLabel", "handwrittenLabel", "instruction"]) {
        const escaped = renderToStaticMarkup(
          createElement("span", null, copy[field]),
        ).slice(6, -7);
        assert.ok(
          markup.includes(escaped),
          `${locale}/${selected.id}/${field}`,
        );
      }
    }
  }
  assert.equal(storage.getItem(TASK_ROTATION_KEY), before);
  console.log(
    "PASS all 320 localized cards preserve task ID, artwork and rotation state",
  );
  console.log(
    "PASS repeated real card renders preserve selected task, artwork and queue",
  );
} finally {
  delete globalThis.__fieldTaskTest;
}
