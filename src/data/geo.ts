import type { Locale } from "../i18n";
import type { SoundLocation } from "../types";
import { worldRequest } from "../world";

export async function searchCities(
  query: string,
  locale: Locale,
  signal: AbortSignal,
): Promise<SoundLocation[]> {
  return worldRequest(
    `/cities?${new URLSearchParams({ q: query, language: locale })}`,
    { signal },
  );
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

export function isWorldRestrictedLocation(location?: SoundLocation) {
  return Boolean(
    location?.countryCode === "UA" &&
    restrictedUkraineRegions.has((location.region || "").trim().toLowerCase()),
  );
}
