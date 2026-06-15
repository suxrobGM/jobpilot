import { createHash } from "node:crypto";
import type { ResumeData } from "@jobpilot/contracts/resume";

function stableId(prefix: string, parts: Array<string | undefined>): string {
  const key = parts.map((p) => (p ?? "").trim().toLowerCase()).join("|");
  const digest = createHash("sha1").update(`${prefix}|${key}`).digest("hex");
  return `${prefix}_${digest.slice(0, 10)}`;
}

interface AssignResult<T> {
  entries: T[];
  mutated: boolean;
}

function assignIds<T extends { id?: string }>(
  entries: T[],
  prefix: string,
  keyParts: (entry: T) => Array<string | undefined>,
): AssignResult<T> {
  const used = new Set<string>();
  let mutated = false;

  const out = entries.map((entry) => {
    if (entry.id) {
      used.add(entry.id);
      return entry;
    }

    const parts = keyParts(entry);
    let id = stableId(prefix, parts);
    let suffix = 1;

    while (used.has(id)) {
      id = stableId(prefix, [...parts, String(suffix++)]);
    }

    used.add(id);
    mutated = true;
    return { ...entry, id };
  });

  return { entries: out, mutated };
}

export interface BackfillResult {
  content: ResumeData;
  mutated: boolean;
}

/**
 * Walk a ResumeData object and assign stable ids to experience and project
 * entries missing them. Idempotent: a second call with the same input mutates
 * nothing and returns `mutated: false`.
 */
export function backfillResumeIds(input: ResumeData): BackfillResult {
  const exp = assignIds(input.experience ?? [], "exp", (e) => [e.company, e.title, e.start]);
  const proj = assignIds(input.projects ?? [], "proj", (p) => [p.name, p.url]);

  if (!exp.mutated && !proj.mutated) return { content: input, mutated: false };
  return {
    content: { ...input, experience: exp.entries, projects: proj.entries },
    mutated: true,
  };
}
