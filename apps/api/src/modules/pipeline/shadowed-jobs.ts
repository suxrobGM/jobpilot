import type { Job, JobStatus } from "@/generated/prisma/client";

/** Furthest along first: the row the Pipeline shows when one posting sits in several feeds. */
const PROGRESS: JobStatus[] = [
  "applied",
  "applying",
  "needs_user",
  "approved",
  "pending",
  "queued",
  "failed",
  "skipped",
];

type PostingRow = Pick<Job, "id" | "url" | "status" | "updatedAt">;

function isAhead(a: PostingRow, b: PostingRow): boolean {
  const rank = PROGRESS.indexOf(a.status) - PROGRESS.indexOf(b.status);
  return rank !== 0 ? rank < 0 : a.updatedAt > b.updatedAt;
}

/** Ids of every row another row of the same posting outranks. */
export function shadowedJobIds(rows: PostingRow[]): string[] {
  const best = new Map<string, PostingRow>();
  for (const row of rows) {
    const current = best.get(row.url);
    if (!current || isAhead(row, current)) {
      best.set(row.url, row);
    }
  }
  return rows.filter((row) => best.get(row.url) !== row).map((row) => row.id);
}
