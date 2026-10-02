import { readUploadForm, UploadLimitError } from "./upload.mjs";
import { wavDuration } from "./world.mjs";

const json = (body, status = 200) => Response.json(body, { status });
const lookup =
  "SELECT * FROM private_file_transfers WHERE user_id=? AND client_id=?";

/** Repair local-file export in Telegram WebViews. The signed session is the
 * sole recipient selector. Stream the explicitly requested WAV to that user's
 * bot chat; store a delivery receipt, never private audio in the World archive. */
export async function transferPrivateFile(request, env, user) {
  let file, data, bytes;
  try {
    const form = await readUploadForm(request);
    const raw = form.get("metadata");
    if (typeof raw !== "string" || raw.length > 2048)
      return json({ error: "Invalid transfer", code: "FILE_METADATA" }, 400);
    data = JSON.parse(raw);
    file = form.get("audio");
    if (
      !/^[0-9a-f-]{36}$/i.test(data.clientId) ||
      !["share", "export"].includes(data.action) ||
      typeof data.title !== "string" ||
      data.title.length > 120
    )
      return json({ error: "Invalid transfer", code: "FILE_METADATA" }, 400);
    if (!(file instanceof Blob) || !file.size)
      return json({ error: "Missing WAV", code: "FILE_AUDIO" }, 400);
    if (file.size > 24000000)
      return json({ error: "Maximum audio 24 MB", code: "FILE_SIZE" }, 413);
    bytes = await file.arrayBuffer();
    wavDuration(bytes, Infinity); // Private export preserves the full file; World still caps at 60s.
  } catch (error) {
    return json(
      {
        error: "Invalid WAV upload",
        code: error instanceof UploadLimitError ? "FILE_SIZE" : "FILE_AUDIO",
      },
      error instanceof UploadLimitError ? 413 : 400,
    );
  }
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  let row = await env.DB.prepare(lookup).bind(user, data.clientId).first();
  if (row && row.audio_hash !== hash)
    return json(
      { error: "Transfer payload changed", code: "FILE_CONFLICT" },
      409,
    );
  if (!row) {
    const rate = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM private_file_transfers WHERE user_id=? AND created_at>?",
    )
      .bind(user, Date.now() - 60000)
      .first();
    if (rate.n >= 10)
      return json({ error: "Please wait", code: "FILE_RATE" }, 429);
    await env.DB.prepare(
      "INSERT INTO private_file_transfers(user_id,client_id,audio_hash,state,created_at) VALUES (?,?,?,'failed',?) ON CONFLICT(user_id,client_id) DO NOTHING",
    )
      .bind(user, data.clientId, hash, Date.now())
      .run();
    row = await env.DB.prepare(lookup).bind(user, data.clientId).first();
    if (row.audio_hash !== hash)
      return json(
        { error: "Transfer payload changed", code: "FILE_CONFLICT" },
        409,
      );
  }
  if (["sending", "uncertain"].includes(row.state))
    return json(
      {
        error: "Check your private FIELD bot chat before retrying",
        code: "FILE_UNCERTAIN",
      },
      409,
    );
  if (row.state !== "delivered") {
    const claim = await env.DB.prepare(
      "UPDATE private_file_transfers SET state='sending' WHERE user_id=? AND client_id=? AND state='failed'",
    )
      .bind(user, data.clientId)
      .run();
    if (!claim.meta?.changes)
      return json(
        { error: "Transfer already in progress", code: "FILE_UNCERTAIN" },
        409,
      );
    const filename = `FIELD_${[...data.title.replace(/[\x00-\x1f\x7f/\\]/g, "-")].slice(0, 60).join("") || "Sound"}.wav`;
    const body = new FormData();
    body.set("chat_id", String(user));
    body.set("document", new Blob([bytes], { type: "audio/wav" }), filename);
    body.set("caption", "FIELD · Tune Tots Lab · WAV");
    let result;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`,
        { method: "POST", body, signal: AbortSignal.timeout(45000) },
      );
      result = await response.json();
    } catch {
      await env.DB.prepare(
        "UPDATE private_file_transfers SET state='uncertain' WHERE user_id=? AND client_id=?",
      )
        .bind(user, data.clientId)
        .run();
      return json(
        {
          error: "Delivery may have completed; check FIELD bot chat",
          code: "FILE_UNCERTAIN",
        },
        409,
      );
    }
    if (!result.ok) {
      await env.DB.prepare(
        "UPDATE private_file_transfers SET state='failed' WHERE user_id=? AND client_id=?",
      )
        .bind(user, data.clientId)
        .run();
      return json(
        { error: "Telegram rejected delivery", code: "FILE_TELEGRAM_REJECTED" },
        result.error_code === 403 ? 403 : 502,
      );
    }
    const message = result.result;
    if (
      !message?.document?.file_id ||
      !Number.isSafeInteger(message.message_id)
    ) {
      await env.DB.prepare(
        "UPDATE private_file_transfers SET state='uncertain' WHERE user_id=? AND client_id=?",
      )
        .bind(user, data.clientId)
        .run();
      return json(
        { error: "Check FIELD bot chat", code: "FILE_UNCERTAIN" },
        409,
      );
    }
    const username = /^[a-zA-Z0-9_]{5,32}$/.test(message.from?.username || "")
      ? message.from.username
      : null;
    await env.DB.prepare(
      "UPDATE private_file_transfers SET state='delivered',message_id=?,telegram_file_id=?,bot_username=? WHERE user_id=? AND client_id=?",
    )
      .bind(
        message.message_id,
        message.document.file_id,
        username,
        user,
        data.clientId,
      )
      .run();
    row = await env.DB.prepare(lookup).bind(user, data.clientId).first();
  }
  let preparedMessageId;
  if (data.action === "share") {
    // Telegram's own file selector, rather than Web Share in WKWebView.
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/savePreparedInlineMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            user_id: user,
            result: {
              type: "document",
              id: data.clientId,
              title: data.title.slice(0, 60) || "FIELD WAV",
              document_file_id: row.telegram_file_id,
            },
            allow_user_chats: true,
            allow_bot_chats: true,
            allow_group_chats: true,
            allow_channel_chats: true,
          }),
        },
      );
      const prepared = await response.json();
      if (prepared.ok && typeof prepared.result?.id === "string")
        preparedMessageId = prepared.result.id;
    } catch {
      /* The private WAV was delivered; the user can forward it from the bot chat. */
    }
  }
  return json({
    delivered: true,
    ...(row.bot_username ? { botUrl: `https://t.me/${row.bot_username}` } : {}),
    ...(preparedMessageId ? { preparedMessageId } : {}),
  });
}
