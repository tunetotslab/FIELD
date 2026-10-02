const visible =
  "SELECT id,metadata FROM sounds WHERE id=? AND group_id IS NULL AND published=1 AND moderation_state='visible'";
async function signature(env, id, expires) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`field-download:${id}:${expires}`),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function downloadTicket(request, env, id) {
  if (!env.WEBHOOK_SECRET || !(await env.DB.prepare(visible).bind(id).first()))
    return Response.json({ error: "Not found" }, { status: 404 });
  const expires = Date.now() + 300000,
    url = new URL(`/download/${id}`, request.url);
  url.search = new URLSearchParams({
    expires: String(expires),
    signature: await signature(env, id, expires),
  }).toString();
  return Response.json({ url: url.href });
}
export async function serveDownload(request, env) {
  const url = new URL(request.url),
    id = url.pathname.slice("/download/".length),
    expires = Number(url.searchParams.get("expires")),
    actual = url.searchParams.get("signature") || "";
  if (
    !env.WEBHOOK_SECRET ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    !Number.isSafeInteger(expires) ||
    expires < Date.now() ||
    expires > Date.now() + 300000 ||
    !/^[0-9a-f]{64}$/.test(actual)
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const expected = await signature(env, id, expires);
  let diff = 0;
  for (let i = 0; i < 64; i++)
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff) return Response.json({ error: "Forbidden" }, { status: 403 });
  const row = await env.DB.prepare(visible).bind(id).first(),
    object = row && (await env.AUDIO.get(id));
  if (!object) return Response.json({ error: "Not found" }, { status: 404 });
  const title = JSON.parse(row.metadata)
    .title.replace(/[\x00-\x1f\x7f/\\]/g, "-")
    .slice(0, 80)
    .toWellFormed();
  return new Response(request.method === "HEAD" ? null : object.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename="field-sound.wav"; filename*=UTF-8''${encodeURIComponent(title + ".wav").replace(/'/g, "%27")}`,
      "Access-Control-Allow-Origin": "https://web.telegram.org",
    },
  });
}
