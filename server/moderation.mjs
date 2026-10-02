import { isAdmin } from "./admin.mjs";
export async function notifyReport(env, telegram, id, reason) {
  if (!Number(env.ADMIN_TELEGRAM_ID)) return;
  const row = await env.DB.prepare(
    "SELECT metadata FROM sounds WHERE id=? AND group_id IS NULL",
  )
    .bind(id)
    .first();
  if (!row) return;
  const metadata = JSON.parse(row.metadata);
  await telegram("sendMessage", {
    chat_id: Number(env.ADMIN_TELEGRAM_ID),
    text: `FIELD World · Жалоба: ${reason}\n${metadata.emojis.join(" ")} ${metadata.title}\n${metadata.location.city}, ${metadata.location.country}`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "▶ Послушать WAV", callback_data: `mod:listen:${id}` }],
        [
          { text: "Оставить", callback_data: `mod:keep:${id}` },
          { text: "Скрыть", callback_data: `mod:hide:${id}` },
        ],
        [{ text: "Удалить аудио…", callback_data: `mod:confirm:${id}` }],
      ],
    },
  });
  await env.DB.prepare(
    "UPDATE sound_reports SET notified_at=? WHERE sound_id=? AND resolved_at IS NULL",
  )
    .bind(Date.now(), id)
    .run();
}
export async function moderationUpdate(update, env, telegram) {
  const callback = update.callback_query,
    message = update.message;
  const data = callback?.data || "",
    command = (message?.text || "").split(/\s+/)[0].replace(/@.*$/, "");
  if (!data.startsWith("mod:") && command !== "/reports") return false;
  const user = callback?.from || message?.from,
    chat = callback?.message?.chat || message?.chat;
  if (
    !isAdmin(env, user?.id) ||
    chat?.type !== "private" ||
    Number(chat.id) !== Number(env.ADMIN_TELEGRAM_ID)
  )
    return true;
  if (command === "/reports") {
    const { results } = await env.DB.prepare(
      "SELECT sound_id,MIN(reason) AS reason FROM sound_reports WHERE resolved_at IS NULL GROUP BY sound_id ORDER BY MIN(created_at) LIMIT 10",
    ).all();
    if (!results.length)
      await telegram("sendMessage", {
        chat_id: chat.id,
        text: "FIELD World · Нет открытых жалоб.",
      });
    for (const row of results)
      await notifyReport(env, telegram, row.sound_id, row.reason);
    return true;
  }
  const [, action, id] = data.split(":");
  if (!/^[0-9a-f-]{36}$/.test(id || "")) return true;
  const row = await env.DB.prepare(
    "SELECT id,published,moderation_state FROM sounds WHERE id=? AND group_id IS NULL",
  )
    .bind(id)
    .first();
  if (!row) return true;
  if (action === "listen") {
    const object = await env.AUDIO.get(id);
    if (object) {
      const form = new FormData();
      form.set("chat_id", String(chat.id));
      form.set(
        "document",
        new Blob([await object.arrayBuffer()], { type: "audio/wav" }),
        "field-report.wav",
      );
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`,
        { method: "POST", body: form },
      );
      if (!response.ok || !(await response.json()).ok)
        throw Error("Telegram unavailable");
    }
  } else if (action === "confirm") {
    await telegram("sendMessage", {
      chat_id: chat.id,
      text: "Удалить опубликованное аудио из World? Локальный файл автора не затрагивается. Это действие нельзя отменить.",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да, удалить", callback_data: `mod:delete:${id}` },
            { text: "Отмена", callback_data: `mod:cancel:${id}` },
          ],
        ],
      },
    });
  } else if (["keep", "hide", "delete"].includes(action)) {
    // Keeping never republishes owner-removed sounds; it only resolves reports.
    if (action !== "keep")
      await env.DB.prepare(
        "UPDATE sounds SET moderation_state=?,published=0 WHERE id=?",
      )
        .bind(action === "delete" ? "removed" : "hidden", id)
        .run();
    if (action === "delete") await env.AUDIO.delete(id);
    await env.DB.prepare(
      "UPDATE sound_reports SET resolved_at=? WHERE sound_id=? AND resolved_at IS NULL",
    )
      .bind(Date.now(), id)
      .run();
    await telegram("sendMessage", {
      chat_id: chat.id,
      text: `FIELD World · ${action === "keep" ? "Жалоба закрыта, публикация оставлена" : action === "hide" ? "Публикация скрыта" : "Публикация и облачное аудио удалены"}.`,
    });
  }
  return true;
}
