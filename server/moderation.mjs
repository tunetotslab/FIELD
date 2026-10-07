import { isAdmin } from "./admin.mjs";
import { removeWorldDelivery } from "./world-delivery.mjs";
export async function deliverReportOutcomes(env, telegram) {
  const copy = {
    ru: {
      keep: "Администратор не обнаружил нарушений. Жалоба закрыта, публикация оставлена. Не каждый подозрительный холодильник — преступник 🧊",
      hide: "Жалоба рассмотрена: запись скрыта из World. Звук отправлен на тихий час 🤫",
      delete:
        "Жалоба удовлетворена: публикация удалена из World. Этот звук покинул планету 🚀",
    },
    en: {
      keep: "No violation found. Report closed; publication remains. Not every suspicious fridge is a criminal 🧊",
      hide: "Report reviewed: publication hidden from World. The sound is taking a quiet break 🤫",
      delete:
        "Report upheld: publication removed from World. This sound has left the planet 🚀",
    },
    hy: {
      keep: "Խախտում չի հայտնաբերվել։ Բողոքը փակված է, հրապարակումը մնում է։ Կասկածելի սառնարանը միշտ չէ, որ հանցագործ է 🧊",
      hide: "Բողոքը դիտարկվել է․ հրապարակումը թաքցված է World-ից։ Ձայնը հանգստանում է 🤫",
      delete:
        "Բողոքն ընդունվել է․ հրապարակումը հեռացված է World-ից։ Ձայնը լքել է մոլորակը 🚀",
    },
    "zh-TW": {
      keep: "未發現違規。檢舉已結案，錄音保留。可疑冰箱不一定是罪犯 🧊",
      hide: "檢舉已審查，錄音已從 World 隱藏。聲音正在安靜休息 🤫",
      delete: "檢舉成立，錄音已從 World 移除。這個聲音離開了星球 🚀",
    },
  };
  const { results } = await env.DB.prepare(
    "SELECT id,reporter_id,reporter_language,resolution FROM sound_reports WHERE resolution IS NOT NULL AND resolution_notified_at IS NULL LIMIT 20",
  ).all();
  for (const row of results) {
    const claim = await env.DB.prepare(
      "UPDATE sound_reports SET resolution_notify_started_at=? WHERE id=? AND resolution_notified_at IS NULL AND (resolution_notify_started_at IS NULL OR resolution_notify_started_at<?)",
    )
      .bind(Date.now(), row.id, Date.now() - 300000)
      .run();
    if (!claim.meta?.changes) continue;
    try {
      await telegram("sendMessage", {
        chat_id: row.reporter_id,
        text: `FIELD World · ${(copy[row.reporter_language] || copy.en)[row.resolution]}`,
      });
      await env.DB.prepare(
        "UPDATE sound_reports SET resolution_notified_at=?,resolution_notify_started_at=NULL WHERE id=?",
      )
        .bind(Date.now(), row.id)
        .run();
    } catch {
      await env.DB.prepare(
        "UPDATE sound_reports SET resolution_notify_started_at=NULL WHERE id=?",
      )
        .bind(row.id)
        .run();
    }
  }
}
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
    text: `FIELD World · Жалоба: ${reason}\n${metadata.emojis.join(" ")} ${metadata.title}\n${metadata.location.city}`,
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
    if (action !== "keep") await removeWorldDelivery(env, id);
    await env.DB.prepare(
      "UPDATE sound_reports SET resolved_at=?,resolution=? WHERE sound_id=? AND resolved_at IS NULL",
    )
      .bind(Date.now(), action, id)
      .run();
    await deliverReportOutcomes(env, telegram);
    await telegram("sendMessage", {
      chat_id: chat.id,
      text: `FIELD World · ${action === "keep" ? "Жалоба закрыта, публикация оставлена" : action === "hide" ? "Публикация скрыта" : "Публикация и облачное аудио удалены"}.`,
    });
  }
  return true;
}
