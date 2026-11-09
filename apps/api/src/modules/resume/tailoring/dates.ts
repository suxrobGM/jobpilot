// A resume writes "Jan 2025", "2025-01", "2016" and "Present" in one section; compare them as months.

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** "Present" sorts last; null when nothing year-like is present, so the caller refuses. */
export function parseResumeDate(raw: string | undefined): number | null {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (/^(present|current|now|ongoing)$/.test(value)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const year = value.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) {
    return null;
  }

  const monthName = Object.keys(MONTHS).find((m) => value.includes(m));
  const numeric = value.match(/\b(?:19|20)\d{2}[-/](\d{1,2})\b/)?.[1];
  const month = monthName ? MONTHS[monthName] : Number(numeric ?? 1);

  return Number(year) * 12 + Math.min(Math.max(month, 1), 12);
}

/** Earliest start and latest end, as the original strings. */
export function dateSpan(
  entries: { start?: string; end?: string }[],
): { start: string; end: string } | null {
  const parsed = (raws: (string | undefined)[]) =>
    raws
      .map((raw) => ({ raw: raw ?? "", value: parseResumeDate(raw) }))
      .filter((d): d is { raw: string; value: number } => d.value !== null);

  const starts = parsed(entries.map((e) => e.start));
  const ends = parsed(entries.map((e) => e.end));

  if (starts.length === 0) {
    return null;
  }

  const earliest = starts.reduce((a, b) => (b.value < a.value ? b : a));
  // No parseable end anywhere means every merged role is open-ended; "Present" is then accurate.
  const latest = ends.length > 0 ? ends.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  return { start: earliest.raw, end: latest?.raw ?? "Present" };
}
