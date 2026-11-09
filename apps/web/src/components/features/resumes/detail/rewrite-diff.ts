import type { ResumeData } from "@jobpilot/contracts/resume";

export interface FieldChange {
  /** Where the change is, e.g. "Summary" or "EmTech Care Labs - bullet 2". */
  where: string;
  before: string;
  after: string;
}

const allBullets = (entries: { bullets: string[] }[]): string[] =>
  entries.flatMap((entry) => entry.bullets);

function compareLists(where: string, before: string[], after: string[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const length = Math.max(before.length, after.length);
  for (let i = 0; i < length; i++) {
    const from = before[i] ?? "";
    const to = after[i] ?? "";
    if (from !== to) {
      changes.push({ where: `${where} ${i + 1}`, before: from, after: to });
    }
  }
  return changes;
}

/** Matches entries positionally: the rewrite skill only rewords, it never reorders or drops. */
export function diffRewrite(base: ResumeData, suggested: ResumeData): FieldChange[] {
  const changes: FieldChange[] = [];

  if ((base.summary ?? "") !== (suggested.summary ?? "")) {
    changes.push({ where: "Summary", before: base.summary ?? "", after: suggested.summary ?? "" });
  }

  for (const [index, role] of suggested.experience.entries()) {
    const previous = base.experience[index];
    if (!previous) {
      continue;
    }
    const label = `${previous.company} bullet`;
    changes.push(...compareLists(label, previous.bullets, role.bullets));
  }

  changes.push(
    ...compareLists("Project bullet", allBullets(base.projects), allBullets(suggested.projects)),
  );

  for (const [index, group] of suggested.skills.entries()) {
    const previous = base.skills[index];
    if (previous && previous.items.join(", ") !== group.items.join(", ")) {
      changes.push({
        where: `Skills - ${group.group}`,
        before: previous.items.join(", "),
        after: group.items.join(", "),
      });
    }
  }

  return changes;
}
