export type WorkLocationType = "onsite" | "remote" | "hybrid";

export interface NormalizedGeo {
  city: string | null;
  region: string | null;
  region_code: string | null;
  country: string | null;
  country_code: string | null;
}

export interface NormalizedJobLocation {
  raw: string;
  normalized: NormalizedGeo;
  type: WorkLocationType;
  unresolved: boolean;
  confidence: number;
}

export interface LocationFilterOption {
  value: string;
  label: string;
}

export interface LocationFilterIndex {
  countries: LocationFilterOption[];
  statesByCountry: Record<string, LocationFilterOption[]>;
  citiesByCountry: Record<string, LocationFilterOption[]>;
  citiesByCountryState: Record<string, LocationFilterOption[]>;
}

const locationCache = new Map<string, NormalizedJobLocation>();

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IT: "Italy",
  FR: "France",
  ES: "Spain",
  DE: "Germany",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  IE: "Ireland",
  PT: "Portugal",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  DK: "Denmark",
  PL: "Poland",
  IN: "India",
  SG: "Singapore",
  AU: "Australia",
  NZ: "New Zealand",
  BR: "Brazil",
  MX: "Mexico",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  AE: "United Arab Emirates",
  IL: "Israel",
};

const COUNTRY_ALIAS_TO_CODE: Record<string, string> = {
  usa: "US",
  us: "US",
  "united states": "US",
  "united states of america": "US",
  america: "US",
  can: "CA",
  canada: "CA",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  england: "GB",
  italy: "IT",
  france: "FR",
  spain: "ES",
  germany: "DE",
  netherlands: "NL",
  belgium: "BE",
  switzerland: "CH",
  ireland: "IE",
  portugal: "PT",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  denmark: "DK",
  poland: "PL",
  india: "IN",
  singapore: "SG",
  australia: "AU",
  "new zealand": "NZ",
  brazil: "BR",
  mexico: "MX",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  china: "CN",
  uae: "AE",
  israel: "IL",
};

const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const CANADA_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

const CITY_ALIAS_MAP: Record<string, string> = {
  sf: "San Francisco",
  nyc: "New York",
  la: "Los Angeles",
};

const CANONICAL_ACCENTED_CITY: Record<string, string> = {
  montreal: "Montréal",
  quebec: "Québec",
};

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function titleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toSlug(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanRawLocation(rawLocation: string): string {
  return rawLocation
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

function stripDecorators(text: string): string {
  return text
    .replace(/\bgreater\b/gi, "")
    .replace(/\bmetro(politan)?\b/gi, "")
    .replace(/\bmetropolitan city of\b/gi, "")
    .replace(/\barea\b/gi, "")
    .replace(/\bregion\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

function resolveCountry(input: string | null): { code: string | null; name: string | null } {
  if (!input) return { code: null, name: null };
  const key = normalizeText(input);
  // "CA" est ambigu (Canada vs California). On n'accepte pas "CA" comme pays sans contexte.
  if (key === "ca") return { code: null, name: null };
  const code = COUNTRY_ALIAS_TO_CODE[key] || null;
  if (!code) return { code: null, name: null };
  return { code, name: COUNTRY_CODE_TO_NAME[code] || null };
}

function resolveRegion(
  input: string | null,
  preferredCountryCode: string | null
): { code: string | null; name: string | null; countryCode: string | null } {
  if (!input) return { code: null, name: null, countryCode: preferredCountryCode };
  const compact = input.trim();
  const upper = compact.toUpperCase();
  const key = normalizeText(compact);

  if (preferredCountryCode === "CA" || !preferredCountryCode) {
    if (CANADA_PROVINCES[upper]) {
      return { code: upper, name: CANADA_PROVINCES[upper], countryCode: "CA" };
    }
    const province = Object.entries(CANADA_PROVINCES).find(
      ([, v]) => normalizeText(v) === key
    );
    if (province) return { code: province[0], name: province[1], countryCode: "CA" };
  }

  if (preferredCountryCode === "US" || !preferredCountryCode) {
    if (US_STATES[upper]) {
      return { code: upper, name: US_STATES[upper], countryCode: "US" };
    }
    const state = Object.entries(US_STATES).find(([, v]) => normalizeText(v) === key);
    if (state) return { code: state[0], name: state[1], countryCode: "US" };
  }

  return { code: null, name: titleCase(compact), countryCode: preferredCountryCode };
}

function canonicalCity(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const alias = CITY_ALIAS_MAP[normalizeText(trimmed)];
  const city = alias || titleCase(trimmed);
  return CANONICAL_ACCENTED_CITY[normalizeText(city)] || city;
}

function classifyType(raw: string): WorkLocationType {
  const lowered = normalizeText(raw);
  if (/\bremote\b/.test(lowered)) return "remote";
  if (/\bhybrid\b/.test(lowered)) return "hybrid";
  return "onsite";
}

export function normalizeLocation(rawLocation: string): NormalizedJobLocation {
  const cacheKey = rawLocation || "";
  const cached = locationCache.get(cacheKey);
  if (cached) return cached;

  const cleaned = cleanRawLocation(rawLocation || "");
  const locationType = classifyType(cleaned);
  const stripped = stripDecorators(cleaned);
  const parts = stripped
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let city: string | null = null;
  let region: string | null = null;
  let regionCode: string | null = null;
  let country: string | null = null;
  let countryCode: string | null = null;

  if (parts.length >= 3) {
    city = canonicalCity(parts[0]);
    const r = resolveRegion(parts[1], null);
    region = r.name;
    regionCode = r.code;
    const c = resolveCountry(parts[2]);
    country = c.name;
    countryCode = c.code;
    if (!countryCode && r.countryCode) {
      countryCode = r.countryCode;
      country = COUNTRY_CODE_TO_NAME[countryCode] || null;
    }
  } else if (parts.length === 2) {
    city = canonicalCity(parts[0]);
    const c = resolveCountry(parts[1]);
    if (c.code) {
      countryCode = c.code;
      country = c.name;
    } else {
      const r = resolveRegion(parts[1], null);
      region = r.name;
      regionCode = r.code;
      countryCode = r.countryCode;
      country = countryCode ? COUNTRY_CODE_TO_NAME[countryCode] : null;
    }
  } else if (parts.length === 1) {
    const single = parts[0];
    const c = resolveCountry(single);
    if (c.code) {
      countryCode = c.code;
      country = c.name;
    } else {
      const r = resolveRegion(single, null);
      if (r.code) {
        region = r.name;
        regionCode = r.code;
        countryCode = r.countryCode;
        country = countryCode ? COUNTRY_CODE_TO_NAME[countryCode] : null;
      } else {
        city = canonicalCity(single);
      }
    }
  }

  if ((locationType === "remote" || locationType === "hybrid") && parts.length > 0) {
    const inMatch = cleaned.match(/\bin\s+([A-Za-z ]+)$/i);
    if (inMatch?.[1]) {
      const c = resolveCountry(inMatch[1]);
      if (c.code) {
        countryCode = c.code;
        country = c.name;
      }
    }
  }

  if (!countryCode && regionCode && CANADA_PROVINCES[regionCode]) {
    countryCode = "CA";
    country = COUNTRY_CODE_TO_NAME.CA;
  }
  if (!countryCode && regionCode && US_STATES[regionCode]) {
    countryCode = "US";
    country = COUNTRY_CODE_TO_NAME.US;
  }

  const unresolved = !(country || region || city);
  const result: NormalizedJobLocation = {
    raw: rawLocation || "",
    normalized: {
      city,
      region,
      region_code: regionCode,
      country,
      country_code: countryCode,
    },
    type: locationType,
    unresolved,
    confidence: unresolved ? 0.2 : country ? 1 : 0.7,
  };
  locationCache.set(cacheKey, result);
  return result;
}

export function normalizeLocations(rawLocations: string[]): NormalizedJobLocation[] {
  const seen = new Set<string>();
  const normalized: NormalizedJobLocation[] = [];
  for (const raw of rawLocations || []) {
    const entry = normalizeLocation(raw);
    const key = [
      entry.type,
      entry.normalized.country_code || entry.normalized.country || "",
      entry.normalized.region_code || entry.normalized.region || "",
      entry.normalized.city || "",
    ].join("::");
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(entry);
    }
  }
  return normalized;
}

function normalizeOptionList(options: LocationFilterOption[]): LocationFilterOption[] {
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function buildFilterIndex(locations: NormalizedJobLocation[]): LocationFilterIndex {
  const countryMap = new Map<string, string>();
  const statesByCountry = new Map<string, Map<string, string>>();
  const citiesByCountry = new Map<string, Map<string, string>>();
  const citiesByCountryState = new Map<string, Map<string, string>>();

  for (const location of locations) {
    if (location.unresolved) continue;
    if (location.type !== "onsite" && location.type !== "hybrid") continue;
    const cCode = location.normalized.country_code;
    const cName = location.normalized.country;
    if (!cCode || !cName) continue;
    countryMap.set(cCode, cName);

    const regionKey = location.normalized.region_code || (location.normalized.region ? toSlug(location.normalized.region) : "");
    if (location.normalized.region && regionKey) {
      if (!statesByCountry.has(cCode)) statesByCountry.set(cCode, new Map());
      statesByCountry.get(cCode)!.set(regionKey, location.normalized.region);
    }

    if (location.normalized.city) {
      const cityKey = toSlug(location.normalized.city);
      if (!citiesByCountry.has(cCode)) citiesByCountry.set(cCode, new Map());
      citiesByCountry.get(cCode)!.set(cityKey, location.normalized.city);

      const stateScope = `${cCode}::${regionKey || "__none__"}`;
      if (!citiesByCountryState.has(stateScope)) citiesByCountryState.set(stateScope, new Map());
      citiesByCountryState.get(stateScope)!.set(cityKey, location.normalized.city);
    }
  }

  const countries = normalizeOptionList(
    Array.from(countryMap.entries()).map(([value, label]) => ({ value, label }))
  );

  const statesObj: Record<string, LocationFilterOption[]> = {};
  for (const [countryCode, states] of statesByCountry.entries()) {
    statesObj[countryCode] = normalizeOptionList(
      Array.from(states.entries()).map(([value, label]) => ({ value, label }))
    );
  }

  const citiesCountryObj: Record<string, LocationFilterOption[]> = {};
  for (const [countryCode, cities] of citiesByCountry.entries()) {
    citiesCountryObj[countryCode] = normalizeOptionList(
      Array.from(cities.entries()).map(([value, label]) => ({ value, label }))
    );
  }

  const citiesCountryStateObj: Record<string, LocationFilterOption[]> = {};
  for (const [scope, cities] of citiesByCountryState.entries()) {
    citiesCountryStateObj[scope] = normalizeOptionList(
      Array.from(cities.entries()).map(([value, label]) => ({ value, label }))
    );
  }

  return {
    countries,
    statesByCountry: statesObj,
    citiesByCountry: citiesCountryObj,
    citiesByCountryState: citiesCountryStateObj,
  };
}

export function matchLocationFilters(
  locations: NormalizedJobLocation[],
  filters: { countryCode: string; regionKey: string; cityKey: string }
): boolean {
  if (filters.countryCode === "all") return true;
  return locations.some((location) => {
    const countryOk =
      location.normalized.country_code === filters.countryCode ||
      normalizeText(location.normalized.country || "") === normalizeText(filters.countryCode);
    if (!countryOk) return false;

    if (filters.regionKey !== "all") {
      const regionKey =
        location.normalized.region_code ||
        (location.normalized.region ? toSlug(location.normalized.region) : "");
      if (regionKey !== filters.regionKey) return false;
    }

    if (filters.cityKey !== "all") {
      const cityKey = location.normalized.city ? toSlug(location.normalized.city) : "";
      if (cityKey !== filters.cityKey) return false;
    }
    return true;
  });
}

export function normalizeSearchText(input: string): string {
  return normalizeText(input);
}

export function formatLocationForDisplay(locations: NormalizedJobLocation[]): string {
  const display = new Set<string>();
  for (const location of locations) {
    if (location.type === "remote") {
      const country = location.normalized.country;
      display.add(country ? `Remote (${country})` : "Remote");
      continue;
    }
    const parts = [
      location.normalized.city,
      location.normalized.region_code || location.normalized.region,
      location.normalized.country || location.normalized.country_code,
    ].filter(Boolean);
    if (parts.length) {
      display.add(parts.join(", "));
    } else if (location.raw.trim()) {
      display.add(location.raw.trim());
    }
  }
  return Array.from(display).join(" | ");
}
