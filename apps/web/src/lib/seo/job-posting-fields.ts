import { getCountries } from "libphonenumber-js";

// Free-text listing fields as Google JobPosting values. Each parser returns null rather than
// guess: a missing field is only a warning, a wrong one makes the item invalid.

const EMPLOYMENT_TYPES: [RegExp, string][] = [
  [/full[\s_-]?time|permanent|\bcdi\b/i, "FULL_TIME"],
  [/part[\s_-]?time/i, "PART_TIME"],
  [/contract|freelance|consultant/i, "CONTRACTOR"],
  [/temporary|fixed[\s-]term|seasonal|interim|\bcdd\b/i, "TEMPORARY"],
  [/intern|co-?op\b/i, "INTERN"],
  [/volunteer/i, "VOLUNTEER"],
  [/per[\s_-]?diem/i, "PER_DIEM"],
];

export function employmentTypes(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return EMPLOYMENT_TYPES.filter(([pattern]) => pattern.test(raw)).map(([, type]) => type);
}

const SALARY_UNITS: [RegExp, string][] = [
  [/hour|\bhr\b|\/h\b/i, "HOUR"],
  [/\bday\b|daily/i, "DAY"],
  [/week/i, "WEEK"],
  [/month|\/mo\b/i, "MONTH"],
  [/year|\byr\b|annual|annum|\/y\b/i, "YEAR"],
];

// Prefixed dollars first: "CA$" also contains "A$", and every one of them contains "$".
const CURRENCY_SYMBOLS: [string, string][] = [
  ["US$", "USD"],
  ["CA$", "CAD"],
  ["C$", "CAD"],
  ["AU$", "AUD"],
  ["A$", "AUD"],
  ["S$", "SGD"],
  ["R$", "BRL"],
  ["$", "USD"],
  ["£", "GBP"],
  ["€", "EUR"],
  ["₹", "INR"],
];

const ISO_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

function salaryCurrency(text: string): string | null {
  for (const match of text.matchAll(/(?<![A-Z])[A-Z]{3}(?![A-Z])/g)) {
    if (ISO_CURRENCIES.has(match[0])) {
      return match[0];
    }
  }
  return CURRENCY_SYMBOLS.find(([symbol]) => text.includes(symbol))?.[1] ?? null;
}

/** Signs are dropped: "-1500000" means the min is missing. */
function salaryAmounts(text: string): number[] {
  return [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi)]
    .map((match) => Number(match[1].replaceAll(",", "")) * (match[2] ? 1000 : 1))
    .filter((amount) => amount > 0);
}

/** With no stated unit, only an amount of 10k or more is trusted, as yearly. */
export function monetaryAmount(raw: string | null): object | null {
  // Only the first clause: "AED 443,600–665,400; UK £77,600–116,400" lists several currencies.
  const text = raw?.split(";")[0] ?? "";
  const currency = salaryCurrency(text);
  const [min, max] = salaryAmounts(text);
  if (!currency || min === undefined) {
    return null;
  }

  const unitText =
    SALARY_UNITS.find(([pattern]) => pattern.test(text))?.[1] ?? (min >= 10_000 ? "YEAR" : null);
  if (!unitText) {
    return null;
  }

  const range = max !== undefined && max > min ? { minValue: min, maxValue: max } : { value: min };
  return {
    "@type": "MonetaryAmount",
    currency,
    value: { "@type": "QuantitativeValue", ...range, unitText },
  };
}

interface Region {
  region: string;
  country: string;
}

const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
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
};

const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
};

// Indian listings name the state but never use its code.
const IN_STATES = [
  "Andhra Pradesh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

const REGIONS_BY_CODE = new Map<string, Region>();
const REGIONS_BY_NAME = new Map<string, Region>();
for (const [country, table] of [
  ["US", US_STATES],
  ["CA", CA_PROVINCES],
] as const) {
  for (const [code, name] of Object.entries(table)) {
    REGIONS_BY_CODE.set(code, { region: code, country });
    REGIONS_BY_NAME.set(name.toLowerCase(), { region: code, country });
  }
}
for (const name of IN_STATES) {
  REGIONS_BY_NAME.set(name.toLowerCase(), { region: name, country: "IN" });
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states of america": "US",
  uk: "GB",
  "u.k.": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  uae: "AE",
  brasil: "BR",
  "czech republic": "CZ",
  turkey: "TR",
  "the netherlands": "NL",
  holland: "NL",
  "hong kong": "HK",
  korea: "KR",
  deutschland: "DE",
};

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** Every live country code by its English name, so there's no hand-kept country table. */
const COUNTRIES = new Map<string, string>(Object.entries(COUNTRY_ALIASES));
for (const code of getCountries()) {
  COUNTRIES.set((REGION_NAMES.of(code) ?? code).toLowerCase(), code);
}

const WORK_MODE =
  /^(remote|remoto|hybrid|on-?site|in-office|work from home|wfh|global|unverified|everywhere|anywhere.*|worldwide.*)$/i;

function regionOf(part: string): Region | null {
  const byCode = /^[A-Z]{2}$/.test(part);
  const region = byCode ? REGIONS_BY_CODE.get(part) : REGIONS_BY_NAME.get(part.toLowerCase());
  return region ?? null;
}

export interface JobLocation {
  locality: string | null;
  region: string | null;
  /** ISO 3166-1 alpha-2 codes; several for "United States or Canada". */
  countries: string[];
}

export function parseJobLocation(raw: string): JobLocation {
  const parts = raw
    .split(/[,;:()|/]|\s[-–—]\s|\s+or\s+|\s+in\s+/i)
    .map((part) =>
      part
        .replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, "")
        .replace(/^the\s+|\s+only$/i, "")
        .trim(),
    )
    .filter((part) => part && !WORK_MODE.test(part));

  const countries = new Set<string>();
  const unknown: string[] = [];
  let region: string | null = null;

  for (const [index, part] of parts.entries()) {
    const country = COUNTRIES.get(part.toLowerCase());
    // A later part is a state before a country ("Atlanta, Georgia"); a lone first part is the reverse.
    const place = index > 0 || (parts.length === 1 && !country) ? regionOf(part) : null;
    if (place) {
      region ??= place.region;
      countries.add(place.country);
    } else if (country) {
      countries.add(country);
    } else {
      unknown.push(part);
    }
  }

  return {
    locality: unknown[0] ?? null,
    region: region ?? unknown[1] ?? null,
    countries: [...countries],
  };
}
