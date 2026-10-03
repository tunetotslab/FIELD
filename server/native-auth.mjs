// Standalone browser/iOS login pairs an explicit private-bot approval with a proof kept
// only inside the app. Telegram identity and group ACLs remain unchanged.
const enabled = (env) =>
  env.NATIVE_AUTH_ENABLED === "true" || env.STANDALONE_AUTH_ENABLED === "true";
const encoder = new TextEncoder();
const json = (body, status = 200) => Response.json(body, { status });
const idPattern = /^[a-f0-9]{32}$/;
const proofPattern = /^[A-Za-z0-9_-]{43}$/;
function random(bytes = 32) {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function digest(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return (
    origin === env.APP_ORIGIN ||
    (env.NATIVE_AUTH_ENABLED === "true" && origin === "capacitor://localhost")
  );
}
async function smallBody(request) {
  // Enforce actual bytes even when Content-Length is absent or understated.
  const reader = request.body?.getReader();
  if (!reader) throw Error("Invalid body");
  let bytes = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2048) throw Error("Too large");
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(result));
}
export async function nativeUser(request, env) {
  if (!enabled(env)) throw Error("Unauthorized");
  const token = (request.headers.get("Authorization") || "").match(
    /^Bearer (field_[A-Za-z0-9_-]{43})$/,
  )?.[1];
  if (!token) throw Error("Unauthorized");
  const session = await env.DB.prepare(
    "SELECT user_id FROM native_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?",
  )
    .bind(await digest(token), Date.now())
    .first();
  if (
    !session ||
    !Number.isSafeInteger(session.user_id) ||
    session.user_id <= 0
  )
    throw Error("Unauthorized");
  return session.user_id;
}
export async function nativeRoute(request, env) {
  const path = new URL(request.url).pathname;
  const browser = path.startsWith("/auth/browser/");
  if (!browser && !path.startsWith("/auth/native/")) return null;
  const route = path.replace("/auth/browser/", "/auth/native/");
  if (
    browser
      ? env.STANDALONE_AUTH_ENABLED !== "true"
      : env.NATIVE_AUTH_ENABLED !== "true"
  )
    return json({ error: "Native login not enabled" }, 503);
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (route === "/auth/native/logout") {
    try {
      await nativeUser(request, env);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = request.headers.get("Authorization").slice(7);
    await env.DB.prepare(
      "UPDATE native_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL",
    )
      .bind(Date.now(), await digest(token))
      .run();
    return json({ ok: true });
  }
  let body;
  try {
    body = await smallBody(request);
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (route === "/auth/native/challenge") {
    // IP is transient rate-limit key, never persisted as an address.
    const key = await digest(
      request.headers.get("CF-Connecting-IP") || "local-development",
    );
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM native_challenges WHERE rate_key=? AND created_at>?",
    )
      .bind(key, Date.now() - 600000)
      .first();
    if (count.n >= 10) return json({ error: "Please wait" }, 429);
    const globalCount = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM native_challenges WHERE created_at>?",
    )
      .bind(Date.now() - 600000)
      .first();
    if (globalCount.n >= 500) return json({ error: "Please wait" }, 429);
    const id = crypto.randomUUID().replace(/-/g, ""),
      proof = random(),
      code = String(
        crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
      ).padStart(6, "0"),
      expiresAt = Date.now() + 600000;
    await env.DB.prepare(
      "INSERT INTO native_challenges(id,proof_hash,code,rate_key,created_at,expires_at) VALUES (?,?,?,?,?,?)",
    )
      .bind(id, await digest(proof), code, key, Date.now(), expiresAt)
      .run();
    return json(
      {
        id,
        proof,
        code,
        expiresAt,
        url: `https://t.me/field_sound_bot?start=field_${browser ? "web" : "ios"}_${id}`,
      },
      201,
    );
  }
  if (!idPattern.test(body?.id || "") || !proofPattern.test(body?.proof || ""))
    return json({ error: "Invalid proof" }, 400);
  const row = await env.DB.prepare(
    "SELECT * FROM native_challenges WHERE id=? AND proof_hash=? AND expires_at>? AND used_at IS NULL AND denied_at IS NULL",
  )
    .bind(body.id, await digest(body.proof), Date.now())
    .first();
  if (!row) return json({ error: "Login expired or unavailable" }, 410);
  if (route === "/auth/native/status")
    return json(
      row.user_id
        ? {
            state: "approved",
            userId: row.user_id,
            displayName: row.display_name,
          }
        : { state: "pending" },
    );
  if (route !== "/auth/native/exchange")
    return json({ error: "Not found" }, 404);
  if (!row.user_id) return json({ error: "Approval required" }, 409);
  const claim = await env.DB.prepare(
    "UPDATE native_challenges SET used_at=? WHERE id=? AND used_at IS NULL AND denied_at IS NULL AND user_id=? AND expires_at>?",
  )
    .bind(Date.now(), row.id, row.user_id, Date.now())
    .run();
  if (Number(claim.meta?.changes) !== 1)
    return json({ error: "Login already used" }, 410);
  const token = `field_${random()}`,
    expiresAt = Date.now() + 30 * 86400000;
  // Only hashes enter D1. Failed session insertion requires a new login challenge.
  await env.DB.prepare(
    "INSERT INTO native_sessions(token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)",
  )
    .bind(await digest(token), row.user_id, Date.now(), expiresAt)
    .run();
  return json({
    token,
    expiresAt,
    userId: row.user_id,
    displayName: row.display_name,
    provider: "telegram",
  });
}
export async function nativeBotUpdate(update, env, telegram) {
  const text = update.message?.text || "",
    data = update.callback_query?.data || "";
  const start = text.match(
      /^\/start(?:@\w+)? field_(?:ios|web)_([a-f0-9]{32})$/,
    ),
    action = data.match(/^ios:(approve|deny):([a-f0-9]{32})$/);
  if (!start && !action) return false;
  if (!enabled(env)) return true;
  const message = update.message || update.callback_query?.message,
    user = update.message?.from || update.callback_query?.from;
  if (
    message?.chat?.type !== "private" ||
    !Number.isSafeInteger(user?.id) ||
    user.id <= 0 ||
    message.chat.id !== user.id
  )
    return true;
  const id = start?.[1] || action[2];
  const row = await env.DB.prepare(
    "SELECT * FROM native_challenges WHERE id=? AND expires_at>? AND used_at IS NULL AND denied_at IS NULL",
  )
    .bind(id, Date.now())
    .first();
  if (!row) {
    await telegram("sendMessage", {
      chat_id: user.id,
      text: "FIELD: login expired. Start again in the app.",
    });
    return true;
  }
  if (start) {
    await telegram("sendMessage", {
      chat_id: user.id,
      text: `FIELD · ${row.code}\n\nApprove only if you just started login in your FIELD app or browser and its six-digit code matches. Never approve a code sent by someone else.\n\nПодтвердите вход, только если начали его сами в FIELD в приложении или браузере и код совпадает.`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Approve / Подтвердить",
              callback_data: `ios:approve:${id}`,
            },
            { text: "Cancel / Отмена", callback_data: `ios:deny:${id}` },
          ],
        ],
      },
    });
    return true;
  }
  // First private approval locks identity. A forwarded link cannot replace it.
  const change =
    action[1] === "approve"
      ? await env.DB.prepare(
          "UPDATE native_challenges SET user_id=?,display_name=? WHERE id=? AND user_id IS NULL AND denied_at IS NULL AND used_at IS NULL AND expires_at>?",
        )
          .bind(
            user.id,
            [user.first_name, user.last_name]
              .filter(Boolean)
              .join(" ")
              .slice(0, 100) || "Telegram",
            id,
            Date.now(),
          )
          .run()
      : await env.DB.prepare(
          "UPDATE native_challenges SET denied_at=? WHERE id=? AND user_id IS NULL AND used_at IS NULL AND denied_at IS NULL",
        )
          .bind(Date.now(), id)
          .run();
  await telegram("sendMessage", {
    chat_id: user.id,
    text: change.meta?.changes
      ? action[1] === "approve"
        ? "FIELD: approved. Return to the app and confirm your account. / Вернитесь в приложение."
        : "FIELD: cancelled. / Отменено."
      : "FIELD: this login is no longer available. / Начните вход заново.",
  });
  return true;
}

export async function purgeExpiredNativeAuth(env) {
  if (!enabled(env)) return;
  // Authentication receipts only. Never touches audio, groups or donations.
  const cutoff = Date.now() - 86400000;
  await env.DB.prepare("DELETE FROM native_challenges WHERE expires_at<?")
    .bind(cutoff)
    .run();
  await env.DB.prepare(
    "DELETE FROM native_sessions WHERE expires_at<? OR revoked_at<?",
  )
    .bind(cutoff, cutoff)
    .run();
}
