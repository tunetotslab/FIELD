import { readUploadForm, UploadLimitError } from "./upload.mjs";
const json = (data, status = 200) => Response.json(data, { status });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const MAX_BYTES = 512 * 1024 * 1024,
  MAX_RECORDS = 1000;
const invalid = (message) => Object.assign(Error(message), { status: 400 });
const key = (user, hash) => `private-library/${user}/${hash}`;
function item(row) {
  return {
    id: row.id,
    revision: row.revision,
    mutationId: row.mutation_id,
    metadata: JSON.parse(row.metadata),
    renderHash: row.render_hash,
    originalHash: row.original_hash,
    renderType: row.render_type,
    originalType: row.original_type,
    deleted: !!row.deleted,
    updatedAt: row.updated_at,
  };
}
async function current(env, user, id) {
  return env.DB.prepare(
    "SELECT * FROM private_library WHERE user_id=? AND id=?",
  )
    .bind(user, id)
    .first();
}
function metadata(value) {
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw invalid("Invalid metadata");
  const {
    audioBlob,
    originalBlob,
    librarySync,
    __fieldAudioData,
    id,
    token,
    proof,
    initData,
    ...data
  } = value;
  const text = JSON.stringify(data);
  if (
    new TextEncoder().encode(text).length > 65536 ||
    typeof data.title !== "string" ||
    data.title.length > 200 ||
    !Number.isFinite(data.createdAt) ||
    !Number.isFinite(data.duration) ||
    data.duration < 0 ||
    !Array.isArray(data.emojis) ||
    data.emojis.length > 3 ||
    data.emojis.some((x) => typeof x !== "string" || x.length > 32) ||
    !Array.isArray(data.waveform) ||
    data.waveform.length > 4096 ||
    data.waveform.some((x) => !Number.isFinite(x))
  )
    throw invalid("Invalid metadata");
  return text;
}
async function audio(env, user, hash, file, oldHash) {
  if (!hashPattern.test(hash || "")) throw invalid("Invalid audio hash");
  if (!file) {
    if (hash !== oldHash) throw invalid("Missing audio");
    return;
  }
  if (!(file instanceof Blob) || file.size === 0)
    throw invalid("Missing audio");
  const bytes = await file.arrayBuffer();
  const actual = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== hash) throw invalid("Audio checksum mismatch");
  // Atomically reserve unique bytes, including deleted/orphaned snapshots.
  // Retry uses the same content hash, never doubles quota or changes old audio.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO private_library_blobs(user_id,hash,size)
    SELECT ?,?,? WHERE COALESCE((SELECT SUM(size) FROM private_library_blobs WHERE user_id=?),0)+?<=?`,
  )
    .bind(user, hash, file.size, user, file.size, MAX_BYTES)
    .run();
  const reserved = await env.DB.prepare(
    "SELECT size FROM private_library_blobs WHERE user_id=? AND hash=?",
  )
    .bind(user, hash)
    .first();
  if (!reserved) {
    const error = Error("Private Library storage limit");
    error.status = 507;
    throw error;
  }
  await env.AUDIO.put(key(user, hash), bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
}
export async function libraryRoute(request, env, user) {
  const url = new URL(request.url);
  if (url.pathname !== "/library" && !url.pathname.startsWith("/library/"))
    return null;
  if (env.LIBRARY_SYNC_ENABLED !== "true")
    return json({ error: "Library sync unavailable" }, 503);
  if (url.pathname === "/library" && request.method === "GET") {
    const cursor = url.searchParams.get("cursor") || "";
    if (cursor && !uuid.test(cursor))
      return json({ error: "Invalid cursor" }, 400);
    const { results } = await env.DB.prepare(
      "SELECT * FROM private_library WHERE user_id=? AND id>? ORDER BY id LIMIT 101",
    )
      .bind(user, cursor)
      .all();
    const rows = results.slice(0, 100);
    return json({
      userId: user,
      items: rows.map(item),
      cursor: results.length > 100 ? rows.at(-1).id : null,
    });
  }
  const match = url.pathname.match(
    /^\/library\/([^/]+)(?:\/(render|original))?$/,
  );
  if (!match || !uuid.test(match[1])) return json({ error: "Not found" }, 404);
  const [, id, part] = match;
  const row = await current(env, user, id);
  if (part && request.method === "GET") {
    if (
      !row ||
      row.deleted ||
      url.searchParams.get("revision") !== row.revision
    )
      return json({ error: "Not found" }, 404);
    const hash = part === "original" ? row.original_hash : row.render_hash;
    if (!hash) return json({ error: "Not found" }, 404);
    const object = await env.AUDIO.get(key(user, hash));
    if (!object) return json({ error: "Audio unavailable" }, 503);
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }
  if (part || !["POST", "DELETE"].includes(request.method))
    return json({ error: "Method not allowed" }, 405);
  try {
    let data, form;
    if (request.method === "POST") {
      form = await readUploadForm(request);
      const manifest = form.get("manifest");
      if (typeof manifest !== "string" || manifest.length > 70000)
        throw invalid("Invalid manifest");
      data = JSON.parse(manifest);
    } else {
      // Reuse the counted multipart boundary for deletes too.
      form = await readUploadForm(request);
      data = JSON.parse(form.get("manifest"));
    }
    if (
      !data ||
      !uuid.test(data.mutationId || "") ||
      (data.baseRevision !== null && !uuid.test(data.baseRevision || ""))
    )
      throw invalid("Invalid revision");
    if (row?.mutation_id === data.mutationId)
      return json({ userId: user, item: item(row) });
    if ((row?.revision || null) !== data.baseRevision)
      return json(
        {
          userId: user,
          item: row ? item(row) : null,
          error: "Revision conflict",
        },
        409,
      );
    if (request.method === "DELETE") {
      if (!row) return json({ error: "Not found" }, 404);
      const revision = crypto.randomUUID();
      const result = await env.DB.prepare(
        "UPDATE private_library SET deleted=1,revision=?,mutation_id=?,updated_at=? WHERE user_id=? AND id=? AND revision=?",
      )
        .bind(revision, data.mutationId, Date.now(), user, id, row.revision)
        .run();
      const latest = await current(env, user, id);
      return json(
        { userId: user, item: item(latest) },
        result.meta.changes ? 200 : 409,
      );
    }
    const text = metadata(data.metadata);
    const renderType =
      typeof data.renderType === "string" ? data.renderType.slice(0, 100) : "";
    const originalType =
      data.originalHash && typeof data.originalType === "string"
        ? data.originalType.slice(0, 100)
        : null;
    await audio(
      env,
      user,
      data.renderHash,
      form.get("render"),
      row?.render_hash,
    );
    if (data.originalHash)
      await audio(
        env,
        user,
        data.originalHash,
        form.get("original"),
        row?.original_hash,
      );
    const revision = crypto.randomUUID(),
      now = Date.now();
    const args = [
      revision,
      data.mutationId,
      text,
      data.renderHash,
      data.originalHash || null,
      renderType,
      originalType,
      now,
    ];
    let result;
    if (row)
      result = await env.DB.prepare(
        `UPDATE private_library SET revision=?,mutation_id=?,metadata=?,render_hash=?,original_hash=?,render_type=?,original_type=?,deleted=0,updated_at=? WHERE user_id=? AND id=? AND revision=?`,
      )
        .bind(...args, user, id, row.revision)
        .run();
    else
      result = await env.DB.prepare(
        `INSERT OR IGNORE INTO private_library(user_id,id,revision,mutation_id,metadata,render_hash,original_hash,render_type,original_type,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM private_library WHERE user_id=?)<?`,
      )
        .bind(user, id, ...args, user, MAX_RECORDS)
        .run();
    const latest = await current(env, user, id);
    if (!latest) return json({ error: "Private Library recording limit" }, 507);
    if (!result.meta.changes)
      return json(
        { userId: user, item: item(latest), error: "Revision conflict" },
        409,
      );
    return json({ userId: user, item: item(latest) }, row ? 200 : 201);
  } catch (error) {
    const status =
      error instanceof UploadLimitError
        ? 413
        : error instanceof SyntaxError
          ? 400
          : error.status || 503;
    return json(
      {
        error:
          status === 413
            ? "Maximum upload 25 MB"
            : status === 400
              ? "Invalid Library upload"
              : status === 507
                ? "Private Library storage limit"
                : "Library temporarily unavailable",
      },
      status,
    );
  }
}
