import type { ResumeData } from "@jobpilot/contracts/resume";
import { matchesTerm, toSearchText } from "@/modules/scoring/keyword-normalize";

/** What a resume states as fact: its numbers and its tech names. */
export interface Corpus {
  /** Normalized for whole-token search. */
  search: string;
  /** Every number the resume states, normalized. */
  numbers: Set<string>;
}

function normalizeNumber(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "").replace(/,/g, "").replace(/\.+$/, "");
}

/**
 * Each number with its unit (`40%`) and bare (`40`), so rewording the unit ("40 percent") is not a
 * new number while a different magnitude still is.
 */
export function extractNumbers(text: string): Set<string> {
  const out = new Set<string>();
  for (const match of text.matchAll(/\d[\d.,]*(?:%|\+)?[kmbx]?/gi)) {
    const full = normalizeNumber(match[0]);
    if (!full) {
      continue;
    }
    out.add(full);
    const core = full.replace(/[%+kmbx]+$/i, "");
    if (core) {
      out.add(core);
    }
  }
  return out;
}

/** A token that looks like a technology or proper noun rather than ordinary prose. */
function isTechLike(token: string): boolean {
  if (/\d/.test(token) && /[a-z]/i.test(token)) {
    return true; // s3, ec2, oauth2
  }
  if (/[a-z][A-Z]/.test(token)) {
    return true; // GraphQL, PostgreSQL, TypeScript
  }
  if (/^[A-Z]{2,6}$/.test(token)) {
    return true; // AWS, GCP, SQL, REST, HIPAA
  }
  if (/[.+#]/.test(token) && /[a-z]/i.test(token)) {
    return true; // .NET, Node.js, C++, C#
  }
  return false;
}

function techTokens(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawToken of text.split(/[\s,;:()/]+/)) {
    // A sentence period is punctuation; a dotted name like Node.js keeps its inner dot.
    const token = rawToken.replace(/^[^A-Za-z0-9.+#]+|[^A-Za-z0-9+#]+$/g, "");
    if (!token || !isTechLike(token)) {
      continue;
    }
    const key = token.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function buildCorpus(base: ResumeData): Corpus {
  const parts: string[] = [base.summary ?? "", base.basics?.headline ?? ""];
  for (const entry of base.experience ?? []) {
    parts.push(entry.title, ...(entry.bullets ?? []));
  }
  for (const project of base.projects ?? []) {
    parts.push(project.description ?? "", ...(project.bullets ?? []), ...(project.keywords ?? []));
  }
  for (const group of base.skills ?? []) {
    parts.push(...(group.items ?? []));
  }
  // A research CV's evidence for a technique lives in its publication titles and its grants, not in
  // a job bullet, so leaving these out rejects terms the resume genuinely supports.
  for (const publication of base.publications ?? []) {
    parts.push(publication.title, publication.venue ?? "");
  }
  for (const certification of base.certifications ?? []) {
    parts.push(certification.name);
  }
  for (const section of base.sections ?? []) {
    for (const entry of section.entries ?? []) {
      parts.push(entry.heading, entry.subheading ?? "", ...(entry.bullets ?? []));
    }
  }
  const raw = parts.join(" ");
  return { search: toSearchText(raw), numbers: extractNumbers(raw) };
}

/** Single-capitalized names like "Kubernetes" slip past; the numbers guard is the hard one. */
export function unverifiedTerms(text: string, corpus: Corpus): string[] {
  return techTokens(text).filter((token) => !matchesTerm(corpus.search, token));
}

export function droppedTerms(original: string, tailored: string): string[] {
  const tailoredSearchText = toSearchText(tailored);
  return techTokens(original).filter((token) => !matchesTerm(tailoredSearchText, token));
}
