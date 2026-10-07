/**
 * Build country-routing shards for country-free city search from the checked-in
 * GeoNames country catalogues. No network or production data is used.
 *
 * node scripts/build-city-search-index.mjs public/geo/v1
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.argv[2] || "public/geo/v1");
const output = resolve(root, "search");
const maximumPrefixLength = 4;
const shardCount = 256;
const shards = Array.from({ length: shardCount }, () => new Map());

function shardFor(value) {
  let hash = 2166136261;
  for (const character of Array.from(value).slice(0, 2)) {
    for (const byte of new TextEncoder().encode(character)) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 24;
}

for (const file of await readdir(root)) {
  if (!/^[A-Z]{2}\.json$/.test(file)) continue;
  const countryCode = file.slice(0, 2);
  const rows = JSON.parse(await readFile(resolve(root, file), "utf8"));
  for (const row of rows) {
    const seen = new Set();
    for (const alias of row[3]) {
      const characters = Array.from(alias);
      for (
        let length = 2;
        length <= Math.min(maximumPrefixLength, characters.length);
        length++
      ) {
        const prefix = characters.slice(0, length).join("");
        const unique = `${prefix}\0${countryCode}`;
        if (seen.has(unique)) continue;
        seen.add(unique);
        const shard = shards[shardFor(prefix)];
        let countries = shard.get(prefix);
        if (!countries) shard.set(prefix, (countries = new Map()));
        countries.set(
          countryCode,
          Math.max(countries.get(countryCode) || 0, row[6] || 0),
        );
      }
    }
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (let index = 0; index < shardCount; index++) {
  const routes = {};
  for (const [prefix, countries] of shards[index])
    routes[prefix] = [...countries]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([country]) => country);
  await writeFile(
    resolve(output, `${index.toString(16).padStart(2, "0")}.json`),
    `${JSON.stringify(routes)}\n`,
  );
}
await writeFile(
  resolve(output, "manifest.json"),
  `${JSON.stringify({ version: 1, maximumPrefixLength, shardCount }, null, 2)}\n`,
);
console.log(`Built ${shardCount} country-routing shards in ${output}`);
