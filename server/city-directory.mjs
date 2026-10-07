// GeoNames catalogue is versioned in this GitHub repository and served by Pages.
// No user coordinates or typed queries are sent to a third-party geocoder.
export const normalizeCitySearch = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim()
    .replace(/\s+/g, " ");
const countries = new Map();
const routes = new Map();
async function catalogue(env, country) {
  const base = env.CITY_DIRECTORY_URL || new URL("geo/v1/", env.APP_URL).href;
  const key = `${base}:${country}`;
  const saved = countries.get(key);
  if (saved && saved.expires > Date.now()) return saved.rows;
  const response = await fetch(new URL(`${country}.json`, base), {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("City catalogue unavailable");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw Error("Invalid city catalogue");
  if (countries.size >= 18) countries.delete(countries.keys().next().value);
  countries.set(key, { rows, expires: Date.now() + 1800000 });
  return rows;
}

export function directoryMatches(rows, query, country, language = "en") {
  const prefix = normalizeCitySearch(query);
  if (Array.from(prefix).length < 2) return [];
  // Aliases are normalized at catalogue build time, keeping Worker CPU bounded.
  return rows
    .filter((row) => row[3].some((alias) => alias.startsWith(prefix)))
    .sort(
      (a, b) =>
        Number(b[3].includes(prefix)) - Number(a[3].includes(prefix)) ||
        b[6] - a[6] ||
        a[0] - b[0],
    )
    .slice(0, 12)
    .map((row) => {
      const names = row[8],
        englishCity = names.en || row[2] || row[1];
      return {
        placeId: `geonames:${row[0]}`,
        city:
          names[language] ||
          (language === "zh-TW" ? names.zh : undefined) ||
          englishCity,
        englishCity,
        nativeCity: names.native || row[1],
        localizedNames: names,
        country: new Intl.DisplayNames([language], { type: "region" }).of(
          country,
        ),
        countryCode: country,
        region: row[7],
        lat: row[4],
        lng: row[5],
        aliases: row[3],
        population: row[6],
      };
    });
}

async function reconcileMatches(env, matches, country) {
  // Keep existing World city IDs. Match a known alias AND nearby city-centre
  // coordinates; never merge different settlements based on a label alone.
  const { results } = await env.DB.prepare(
    "SELECT id,location FROM world_cities WHERE json_extract(location,'$.countryCode')=?",
  )
    .bind(country)
    .all();
  return matches.map(({ aliases, population, ...location }) => {
    const old = results.filter((row) => {
      const city = JSON.parse(row.location);
      const dy = (city.lat - location.lat) * 111;
      const dx =
        (city.lng - location.lng) *
        111 *
        Math.cos((location.lat * Math.PI) / 180);
      return (
        aliases.includes(normalizeCitySearch(city.city)) &&
        Math.hypot(dx, dy) < 10
      );
    });
    return old.length === 1 ? { ...location, placeId: old[0].id } : location;
  });
}

export async function directorySearch(env, query, country, language) {
  const matches = directoryMatches(
    await catalogue(env, country),
    query,
    country,
    language,
  );
  return reconcileMatches(env, matches, country);
}

function routeShard(value) {
  let hash = 2166136261;
  for (const character of Array.from(value).slice(0, 2)) {
    for (const byte of new TextEncoder().encode(character)) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 24).toString(16).padStart(2, "0");
}

async function routeCountries(env, query) {
  const normalized = normalizeCitySearch(query);
  const base = env.CITY_DIRECTORY_URL || new URL("geo/v1/", env.APP_URL).href;
  const shard = routeShard(normalized),
    key = `${base}:search:${shard}`;
  let index = routes.get(key);
  if (!index) {
    const response = await fetch(new URL(`search/${shard}.json`, base), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("City search index unavailable");
    index = await response.json();
    if (!index || typeof index !== "object" || Array.isArray(index))
      throw Error("Invalid city search index");
    if (routes.size >= 3) routes.delete(routes.keys().next().value);
    routes.set(key, index);
  }
  const characters = Array.from(normalized);
  for (let length = Math.min(4, characters.length); length >= 2; length--) {
    const found = index[characters.slice(0, length).join("")];
    if (Array.isArray(found)) return found.slice(0, 18);
  }
  return [];
}

export async function globalDirectorySearch(env, query, language) {
  const prefix = normalizeCitySearch(query);
  const countryCodes = await routeCountries(env, prefix);
  const perCountry = await Promise.all(
    countryCodes.map(async (country) => ({
      country,
      matches: directoryMatches(
        await catalogue(env, country),
        prefix,
        country,
        language,
      ),
    })),
  );
  const best = perCountry
    .flatMap(({ country, matches }) =>
      matches.map((location) => ({ country, location })),
    )
    .sort(
      (a, b) =>
        Number(b.location.aliases.includes(prefix)) -
          Number(a.location.aliases.includes(prefix)) ||
        b.location.population - a.location.population ||
        a.location.city.localeCompare(b.location.city, language),
    )
    .slice(0, 12);
  const reconciled = new Map();
  for (const country of new Set(best.map((item) => item.country)))
    reconciled.set(
      country,
      await reconcileMatches(
        env,
        best
          .filter((item) => item.country === country)
          .map((item) => item.location),
        country,
      ),
    );
  return best
    .map(
      ({ country, location }) =>
        reconciled
          .get(country)
          .find((item) => item.placeId === location.placeId) ||
        reconciled.get(country).find((item) => item.city === location.city),
    )
    .filter(Boolean);
}

const restrictedUkraineRegions = new Set([
  "crimea",
  "autonomous republic of crimea",
  "sevastopol",
  "sevastopol city",
  "donetsk",
  "donetsk oblast",
  "luhansk",
  "luhansk oblast",
  "lugansk",
  "lugansk oblast",
  "zaporizhzhia",
  "zaporizhia",
  "zaporozhye",
  "kherson",
  "kherson oblast",
]);
export function worldPublicationRestricted(location) {
  return (
    location?.countryCode === "UA" &&
    restrictedUkraineRegions.has(normalizeCitySearch(location.region))
  );
}
