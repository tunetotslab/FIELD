import type { Locale } from "../i18n";
import type { SoundLocation } from "../types";

const ISO_CODES =
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(
    " ",
  );

export interface CountryOption {
  code: string;
  name: string;
  searchNames: string[];
}

export function countries(locale: Locale): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const indexes = ["en", "ru", "hy", "zh-TW"].map(
    (language) => new Intl.DisplayNames([language], { type: "region" }),
  );
  return ISO_CODES.map((code) => ({
    code,
    name: names.of(code) || code,
    searchNames: [
      ...new Set([code, ...indexes.map((index) => index.of(code) || code)]),
    ],
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

type NominatimPlace = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
};

export async function searchCities(
  query: string,
  country: CountryOption,
  locale: Locale,
  signal: AbortSignal,
): Promise<SoundLocation[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", country.code.toLowerCase());
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", locale);
  url.searchParams.set("limit", "8");
  url.searchParams.set("featuretype", "city");
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Place search failed (${response.status})`);
  const places = (await response.json()) as NominatimPlace[];
  return places.flatMap((place) => {
    const address = place.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet;
    if (!city) return [];
    return [
      {
        placeId: `osm:${place.place_id}`,
        city,
        country: address.country || country.name,
        countryCode: (address.country_code || country.code).toUpperCase(),
        region: address.state || address.region || address.county,
        lat: Number(place.lat),
        lng: Number(place.lon),
      },
    ];
  });
}
