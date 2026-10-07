// Durable queue. Never automatically resend an ambiguous network timeout:
// Telegram has no idempotency key for sendDocument.
export async function deliverWorld(env) {
  if (env.WORLD_ENABLED !== "true" || !env.WORLD_TELEGRAM_CHAT) return;
  const removed = await env.DB.prepare(
    "SELECT d.sound_id FROM world_telegram_deliveries d JOIN sounds s ON s.id=d.sound_id WHERE d.state='delivered' AND (s.published=0 OR s.moderation_state!='visible') LIMIT 10",
  ).all();
  for (const row of removed.results)
    await removeWorldDelivery(env, row.sound_id);
  await env.DB.prepare(
    "INSERT INTO world_telegram_deliveries(sound_id,chat_id,state,updated_at) SELECT id,?,'queued',? FROM sounds WHERE published=1 AND moderation_state='visible' AND group_id IS NULL ON CONFLICT(sound_id) DO NOTHING",
  )
    .bind(env.WORLD_TELEGRAM_CHAT, Date.now())
    .run();
  const { results } = await env.DB.prepare(
    "SELECT d.sound_id,d.chat_id,s.metadata FROM world_telegram_deliveries d JOIN sounds s ON s.id=d.sound_id WHERE d.state IN ('queued','failed') AND s.published=1 AND s.moderation_state='visible' AND s.group_id IS NULL ORDER BY d.updated_at,s.created_at LIMIT 10",
  ).all();
  for (const row of results) {
    const claim = await env.DB.prepare(
      "UPDATE world_telegram_deliveries SET state='sending',updated_at=? WHERE sound_id=? AND state IN ('queued','failed')",
    )
      .bind(Date.now(), row.sound_id)
      .run();
    if (!claim.meta?.changes) continue;
    let state = "failed",
      error = null,
      messageId = null;
    try {
      const object = await env.AUDIO.get(row.sound_id);
      if (!object) throw Error("Audio missing");
      const data = JSON.parse(row.metadata),
        form = new FormData();
      form.set("chat_id", row.chat_id);
      form.set(
        "document",
        new Blob([await object.arrayBuffer()], { type: "audio/wav" }),
        "field-sound.wav",
      );
      form.set(
        "caption",
        `${data.emojis.join(" ")} ${data.title}\n${data.location.city}\nFIELD World · ${env.APP_URL}`.slice(
          0,
          1024,
        ),
      );
      state = "uncertain";
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`,
        { method: "POST", body: form, signal: AbortSignal.timeout(30000) },
      );
      const result = await response.json();
      if (result.ok) {
        state = "delivered";
        messageId = result.result.message_id;
      } else {
        state = "failed";
        error = String(
          result.description || "Telegram rejected delivery",
        ).slice(0, 250);
      }
    } catch {
      error =
        state === "uncertain"
          ? "Delivery result unknown; manual review required"
          : "Could not prepare audio";
    }
    await env.DB.prepare(
      "UPDATE world_telegram_deliveries SET state=?,message_id=?,last_error=?,updated_at=? WHERE sound_id=?",
    )
      .bind(state, messageId, error, Date.now(), row.sound_id)
      .run();
  }
}
export async function removeWorldDelivery(env, id) {
  const row = await env.DB.prepare(
    "SELECT chat_id,message_id FROM world_telegram_deliveries WHERE sound_id=?",
  )
    .bind(id)
    .first();
  if (!row?.message_id) return;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: row.chat_id,
          message_id: row.message_id,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if ((await response.json()).ok)
      await env.DB.prepare(
        "UPDATE world_telegram_deliveries SET state='removed' WHERE sound_id=?",
      )
        .bind(id)
        .run();
  } catch {
    /* Copies already downloaded cannot be recalled. */
  }
}
