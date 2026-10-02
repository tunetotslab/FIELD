import { directorySearch, normalizeCitySearch } from "./city-directory.mjs";
import { readUploadForm, UploadLimitError } from './upload.mjs';
import { downloadTicket } from "./downloads.mjs";
import { removeWorldDelivery } from "./world-delivery.mjs";
// City-level archive only. Never copy arbitrary client metadata into public rows.
const json = (body, status = 200) => Response.json(body, { status });
export const REPORT_REASONS = ["privacy", "abuse", "copyright", "other"];
export function wavDuration(bytes) {
  const view = new DataView(bytes);
  const text = (offset) =>
    new TextDecoder().decode(bytes.slice(offset, offset + 4));
  if (
    bytes.byteLength < 44 ||
    text(0) !== "RIFF" ||
    text(8) !== "WAVE" ||
    view.getUint32(4, true) + 8 !== bytes.byteLength
  )
    throw Error("Invalid WAV");
  let rate = 0,
    block = 0,
    size = 0,
    foundData = false;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const n = view.getUint32(offset + 4, true),
      kind = text(offset),
      start = offset + 8;
    if (start + n > bytes.byteLength) throw Error("Invalid WAV chunk");
    if (kind === "fmt ") {
      if (n < 16 || view.getUint16(start, true) !== 1)
        throw Error("PCM WAV required");
      const channels = view.getUint16(start + 2, true),
        sampleRate = view.getUint32(start + 4, true),
        bits = view.getUint16(start + 14, true);
      block = view.getUint16(start + 12, true);
      rate = view.getUint32(start + 8, true);
      if (
        ![1, 2].includes(channels) ||
        ![16, 24, 32].includes(bits) ||
        sampleRate < 8000 ||
        sampleRate > 96000 ||
        block !== (channels * bits) / 8 ||
        rate !== sampleRate * block
      )
        throw Error("Invalid PCM");
    }
    if (kind === "data") {
      if (foundData) throw Error("Duplicate data");
      foundData = true;
      size = n;
    }
    offset = start + n + (n % 2);
  }
  const duration = size / rate;
  if (
    !block ||
    size % block ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 60
  )
    throw Error("Maximum 60 seconds");
  return duration;
}
export async function searchCity(env, query, country, language = "en") {
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.length > 100 ||
    !/^[A-Z]{2}$/.test(country)
  )
    throw Error("City required");
  const cacheKey = `directory-v1:${country}:${language}:${normalizeCitySearch(query)}`;
  const cached = await env.DB.prepare(
    "SELECT results FROM city_search_cache WHERE id=? AND expires_at>?",
  ).bind(cacheKey, Date.now()).first();
  if (cached) return JSON.parse(cached.results);
  const now = Date.now();
  const locations = await directorySearch(env, query, country, language);
  if (locations.length)
    await env.DB.batch(
      locations.map((location) =>
        env.DB.prepare(
          "INSERT INTO world_cities (id,location) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET location=excluded.location",
        ).bind(location.placeId, JSON.stringify(location)),
      ),
    );
  await env.DB.prepare(
    "INSERT INTO city_search_cache (id,results,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET results=excluded.results,expires_at=excluded.expires_at",
  )
    .bind(cacheKey, JSON.stringify(locations), now + 30 * 86400000)
    .run();
  return locations;
}
const publicRow = (row) => ({
  ...JSON.parse(row.metadata),
  id: row.id,
  likes: row.likes || 0,
  liked: Boolean(row.liked),
});
export async function resolveCity(env, data) {
  if (!data || typeof data.placeId !== "string" || data.placeId.length > 100)
    throw Error("City required");
  const cached = await env.DB.prepare(
    "SELECT location FROM world_cities WHERE id=?",
  )
    .bind(data.placeId)
    .first();
  if (cached) return JSON.parse(cached.location);
  // Legacy osm:<place_id> is unstable. Resolve its named settlement afresh;
  // never import the old client coordinates into the server city directory.
  const language = ["en", "ru", "hy", "zh-TW"].includes(data.language)
    ? data.language
    : "en";
  const locations = await searchCity(
    env,
    data.city,
    data.countryCode,
    language,
  );
  if (locations.length === 1) return locations[0];
  const normalized = normalizeCitySearch;
  const matches = locations.filter(
    (location) => [location.city, location.englishCity, location.nativeCity,
      ...Object.values(location.localizedNames || {})].some(name =>
        normalized(name) === normalized(data.city)),
  );
  if (matches.length === 1) return matches[0];
  const regionMatches = matches.filter(
    (location) =>
      data.region && normalized(location.region) === normalized(data.region),
  );
  if (regionMatches.length === 1) return regionMatches[0];
  throw Error("Choose a city from search results");
}
export async function worldRoute(request, env, user, notify) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (path === "/cities" && method === "GET") {
    try {
      return json(
        await searchCity(
          env,
          url.searchParams.get("q"),
          url.searchParams.get("country"),
          ["en", "ru", "hy", "zh-TW"].includes(url.searchParams.get("language"))
            ? url.searchParams.get("language")
            : "en",
        ),
      );
    } catch {
      return json({ error: "City lookup unavailable; try again" }, 503);
    }
  }
  if (path === "/cities/resolve" && method === "POST") {
    if (Number(request.headers.get("Content-Length")) > 2048)
      return json({ error: "Too large" }, 413);
    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid city" }, 400);
    }
    try {
      return json(await resolveCity(env, data));
    } catch {
      return json({ error: "Please choose the city again" }, 400);
    }
  }
  if (!path.startsWith("/world")) return null;
  if (env.WORLD_ENABLED !== "true")
    return json({ error: "World unavailable" }, 503);
  if (path === "/world" && method === "POST") {
    let form, data, duration;
    try {
      form = await readUploadForm(request);
      data = JSON.parse(String(form.get("metadata")));
    } catch (error) {
      if (error instanceof UploadLimitError) return json({error: 'Maximum upload 25 MB'}, 413);
      return json({ error: "Invalid metadata" }, 400);
    }
    const audio = form.get("audio");
    if (
      !(audio instanceof File) ||
      audio.size > 24000000 ||
      !data ||
      typeof data.title !== "string" ||
      !data.title.trim() ||
      data.title.length > 80 ||
      !Array.isArray(data.emojis) ||
      data.emojis.length !== 3 ||
      data.emojis.some(
        (e) => typeof e !== "string" || !e.trim() || e.length > 32,
      ) ||
      !Number.isFinite(data.duration) ||
      data.duration <= 0 ||
      data.duration > 60 ||
      !/^[-a-zA-Z0-9]{1,100}$/.test(data.id || "")
    )
      return json({ error: "Invalid sound" }, 400);
    try {
      duration = wavDuration(await audio.arrayBuffer());
    } catch {
      return json(
        { error: "Valid PCM WAV, maximum 60 seconds, required" },
        400,
      );
    }
    if (Math.abs(duration - data.duration) > 0.1)
      return json({ error: "Duration mismatch" }, 400);
    const existing = await env.DB.prepare(
      "SELECT id,published,moderation_state FROM sounds WHERE user_id=? AND client_id=? AND group_id IS NULL",
    )
      .bind(user, data.id)
      .first();
    if (existing) {
      if (!existing.published || existing.moderation_state !== "visible")
        return json(
            { error: "This publication was removed; make a new local version" },
            409,
          );
      // A D1 row alone cannot confirm a playable publication. Do not overwrite
      // or delete uncertain user data when an R2 object is missing.
      if (!(await env.AUDIO.head(existing.id)))
        return json({error:'Published audio unavailable'},503);
      return json({id:existing.id});
    }
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sounds WHERE user_id=? AND created_at>?",
    )
      .bind(user, Date.now() - 86400000)
      .first();
    if (recent.n >= 20) return json({ error: "Daily upload limit" }, 429);
    const city = await env.DB.prepare(
      "SELECT location FROM world_cities WHERE id=?",
    )
      .bind(data.location?.placeId || "")
      .first();
    if (!city) return json({ error: "Choose a city from search results" }, 400);
    const location = JSON.parse(city.location);
    const metadata = {
      title: data.title.trim(),
      emojis: data.emojis,
      duration,
      createdAt: Date.now(),
      visibility: "world",
      styleId: [
        "grotesk",
        "bubble",
        "gothic",
        "times",
        "italic",
        "experimental",
      ].includes(data.styleId)
        ? data.styleId
        : "grotesk",
      effect:
        typeof data.effect === "string" ? data.effect.slice(0, 20) : "original",
      waveform: Array.isArray(data.waveform)
        ? data.waveform
            .slice(0, 160)
            .map((x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0))
        : [],
      location,
    };
    const id = crypto.randomUUID();
    await env.AUDIO.put(id, audio.stream(), {
      httpMetadata: { contentType: "audio/wav" },
    });
    try {
      await env.DB.prepare(
        "INSERT INTO sounds (id,user_id,metadata,published,created_at,city_key,client_id) VALUES (?,?,?,1,?,?,?)",
      )
        .bind(
          id,
          user,
          JSON.stringify(metadata),
          metadata.createdAt,
          location.placeId,
          data.id,
        )
        .run();
    } catch (error) {
      await env.AUDIO.delete(id);
      const race = await env.DB.prepare(
        "SELECT id FROM sounds WHERE user_id=? AND client_id=? AND group_id IS NULL AND published=1 AND moderation_state='visible'",
      )
        .bind(user, data.id)
        .first();
      if (race) return json({ id: race.id });
      throw error;
    }
    return json({ id, ...metadata }, 201);
  }
  if (path === "/world/cities" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT city_key,COUNT(*) AS count,MIN(metadata) AS metadata FROM sounds WHERE published=1 AND moderation_state='visible' AND group_id IS NULL GROUP BY city_key",
    ).all();
    return json(
      results
        .filter((r) => r.city_key)
        .map((r) => ({
          id: r.city_key,
          ...JSON.parse(r.metadata).location,
          count: r.count,
        })),
    );
  }
  if (path === "/world" && method === "GET") {
    const city = url.searchParams.get("city");
    if (!city || city.length > 100)
      return json({ error: "City required" }, 400);
    let cursor;
    try {
      cursor = url.searchParams.get("cursor")
        ? JSON.parse(atob(url.searchParams.get("cursor")))
        : null;
    } catch {
      return json({ error: "Invalid cursor" }, 400);
    }
    if (
      cursor &&
      (!Number.isSafeInteger(cursor.time) ||
        typeof cursor.id !== "string" ||
        cursor.id.length > 100)
    )
      return json({ error: "Invalid cursor" }, 400);
    const { results } = await env.DB.prepare(
      "SELECT id,metadata,created_at,(SELECT COUNT(*) FROM sound_likes WHERE sound_id=sounds.id) AS likes,EXISTS(SELECT 1 FROM sound_likes WHERE sound_id=sounds.id AND user_id=?) AS liked FROM sounds WHERE city_key=? AND published=1 AND moderation_state='visible' AND group_id IS NULL AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 21",
    )
      .bind(
        user,
        city,
        cursor?.time || Number.MAX_SAFE_INTEGER,
        cursor?.time || Number.MAX_SAFE_INTEGER,
        cursor?.id || "",
      )
      .all();
    const items = results.slice(0, 20),
      last = items.at(-1);
    return json({
      items: items.map(publicRow),
      nextCursor:
        results.length > 20
          ? btoa(JSON.stringify({ time: last.created_at, id: last.id }))
          : null,
    });
  }
  const extra = path.match(/^\/world\/([0-9a-f-]{36})\/(likes|download)$/i);
  if (extra) {
    const id = extra[1];
    if (
      !(await env.DB.prepare(
        "SELECT id FROM sounds WHERE id=? AND group_id IS NULL AND published=1 AND moderation_state='visible'",
      )
        .bind(id)
        .first())
    )
      return json({ error: "Not found" }, 404);
    if (extra[2] === "download" && method === "POST")
      return downloadTicket(request, env, id);
    if (extra[2] === "likes" && ["POST", "DELETE"].includes(method)) {
      if (method === "POST")
        await env.DB.prepare(
          "INSERT INTO sound_likes(sound_id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        )
          .bind(id, user)
          .run();
      else
        await env.DB.prepare(
          "DELETE FROM sound_likes WHERE sound_id=? AND user_id=?",
        )
          .bind(id, user)
          .run();
      return json(
        await env.DB.prepare(
          "SELECT COUNT(*) AS likes,EXISTS(SELECT 1 FROM sound_likes WHERE sound_id=? AND user_id=?) AS liked FROM sound_likes WHERE sound_id=?",
        )
          .bind(id, user, id)
          .first(),
      );
    }
  }
  const match = path.match(/^\/world\/([0-9a-f-]{36})(\/reports)?$/i);
  if (match && method === "DELETE" && !match[2]) {
    const row = await env.DB.prepare(
      "SELECT id FROM sounds WHERE id=? AND user_id=? AND group_id IS NULL",
    )
      .bind(match[1], user)
      .first();
    if (!row) return json({ error: "Not found" }, 404);
    await env.DB.prepare("UPDATE sounds SET published=0 WHERE id=?")
      .bind(row.id)
      .run();
    await env.AUDIO.delete(row.id);
    await removeWorldDelivery(env, row.id);
    return json({ ok: true });
  }
  if (match && method === "POST" && match[2]) {
    if (Number(request.headers.get("Content-Length")) > 1024)
      return json({ error: "Too large" }, 413);
    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid report" }, 400);
    }
    if (!REPORT_REASONS.includes(data.reason))
      return json({ error: "Invalid reason" }, 400);
    const sound = await env.DB.prepare(
      "SELECT id FROM sounds WHERE id=? AND published=1 AND moderation_state='visible' AND group_id IS NULL",
    )
      .bind(match[1])
      .first();
    if (!sound) return json({ error: "Not found" }, 404);
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sound_reports WHERE reporter_id=? AND created_at>?",
    )
      .bind(user, Date.now() - 86400000)
      .first();
    if (count.n >= 10) return json({ error: "Daily report limit" }, 429);
    const inserted = await env.DB.prepare(
      "INSERT INTO sound_reports (id,sound_id,reporter_id,reason,created_at,reporter_language) VALUES (?,?,?,?,?,?) ON CONFLICT(sound_id,reporter_id) DO NOTHING",
    )
      .bind(
        crypto.randomUUID(),
        sound.id,
        user,
        data.reason,
        Date.now(),
        ["en", "ru", "hy", "zh-TW"].includes(data.language)
          ? data.language
          : "en",
      )
      .run();
    // Report durability never depends on Telegram delivery. /reports recovers failures.
    if (inserted.meta?.changes)
      try {
        await notify(sound.id, data.reason);
      } catch {
        /* Human moderation queue retained. */
      }
    return json({ ok: true }, 201);
  }
  return json({ error: "Not found" }, 404);
}
