import { mkdir, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { slugify } from "@/common/utils/slug";

const STORAGE_ROOT = path.resolve(env.STORAGE_ROOT);
const RESUMES_DIR = path.join(STORAGE_ROOT, "resumes");
const GENERATED_DIR = path.join(STORAGE_ROOT, "resumes-generated");
const BACKUPS_DIR = path.join(STORAGE_ROOT, "resume-backups");

export async function ensureResumesDir(): Promise<string> {
  await mkdir(RESUMES_DIR, { recursive: true });
  return RESUMES_DIR;
}

export async function ensureGeneratedDir(): Promise<string> {
  await mkdir(GENERATED_DIR, { recursive: true });
  return GENERATED_DIR;
}

export async function ensureResumeBackupsDir(): Promise<string> {
  await mkdir(BACKUPS_DIR, { recursive: true });
  return BACKUPS_DIR;
}

export function resumePath(filename: string): string {
  return path.join(RESUMES_DIR, filename);
}

export function generatedResumePath(id: string, updatedAtMs: number): string {
  return path.join(GENERATED_DIR, `master-${id}-${updatedAtMs}.pdf`);
}

export function generatedVariantPath(variantId: string, createdAtMs: number): string {
  return path.join(GENERATED_DIR, `variant-${variantId}-${createdAtMs}.pdf`);
}

export function resumeBackupPath(resumeId: string, updatedAtMs: number): string {
  return path.join(BACKUPS_DIR, `resume-${resumeId}-${updatedAtMs}.json`);
}

/** Unlinks a file, treating an already-missing file as success. Returns whether it removed anything. */
async function tryUnlink(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw e;
  }
}

export async function deleteResumeFile(filename: string): Promise<void> {
  await tryUnlink(resumePath(filename));
}

/** Unlinks files in a directory that match a given prefix and suffix. */
async function unlinkMatching(dir: string, prefix: string, suffix: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw e;
  }

  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
      .map((name) => tryUnlink(path.join(dir, name))),
  );
}

export function deleteResumeBackups(resumeId: string): Promise<void> {
  return unlinkMatching(BACKUPS_DIR, `resume-${resumeId}-`, ".json");
}

export function deleteGeneratedResumeFiles(resumeId: string): Promise<void> {
  return unlinkMatching(GENERATED_DIR, `master-${resumeId}-`, ".pdf");
}

export function deleteGeneratedVariantFiles(variantId: string): Promise<void> {
  return unlinkMatching(GENERATED_DIR, `variant-${variantId}-`, ".pdf");
}

interface ResumeArtifactRefs {
  resumeId: string;
  sourceFilename: string | null;
  variantIds: string[];
}

export async function deleteAllResumeArtifacts(refs: ResumeArtifactRefs): Promise<void> {
  const { resumeId, sourceFilename, variantIds } = refs;
  await Promise.all([
    sourceFilename ? deleteResumeFile(sourceFilename) : Promise.resolve(),
    deleteResumeBackups(resumeId),
    deleteGeneratedResumeFiles(resumeId),
    ...variantIds.map((id) => deleteGeneratedVariantFiles(id)),
  ]);
}

export function generateResumeFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".pdf";
  const slug = slugify(path.basename(originalName, ext), { fallback: "resume" });
  return `${slug}-${Date.now()}${ext}`;
}

export function slugifyForDownload(label: string): string {
  return slugify(label, { fallback: "resume" });
}

/**
 * Ensures a PDF exists at `cachePath`, rendering it via `render` on a miss. On a hit
 * it bumps the file's mtime so the prune sweep treats time-since-last-download as the
 * idle clock (a frequently downloaded PDF whose source hasn't changed stays warm). The
 * cache is fully regenerable — eviction only costs a re-render on the next request.
 */
export async function ensureCachedPdf(
  cachePath: string,
  render: () => Promise<Buffer>,
): Promise<void> {
  try {
    await stat(cachePath);
  } catch {
    const buffer = await render();
    await writeFile(cachePath, buffer);
    return;
  }
  // Recency bump is best-effort — never fail a download because utimes hiccuped.
  const now = new Date();
  try {
    await utimes(cachePath, now, now);
  } catch {
    // ignore
  }
}

export interface CachePruneResult {
  scanned: number;
  removed: number;
  freedBytes: number;
  remainingBytes: number;
}

/**
 * Prunes the generated-PDF cache so it can't fill the disk: first evicts files idle
 * longer than `ttlMs`, then, if the survivors still exceed `maxBytes`, evicts coldest
 * (oldest mtime) first until under the cap. A `ttlMs`/`maxBytes` of 0 disables that
 * stage. Safe to run repeatedly — every evicted file is re-rendered on next download.
 */
export async function pruneGeneratedCache(opts: {
  ttlMs: number;
  maxBytes: number;
}): Promise<CachePruneResult> {
  let names: string[];
  try {
    names = await readdir(GENERATED_DIR);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { scanned: 0, removed: 0, freedBytes: 0, remainingBytes: 0 };
    }
    throw e;
  }

  const files: { path: string; size: number; mtimeMs: number }[] = [];
  await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(GENERATED_DIR, name);
      try {
        const s = await stat(filePath);
        if (s.isFile()) {
          files.push({ path: filePath, size: s.size, mtimeMs: s.mtimeMs });
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
          throw e;
        }
      }
    }),
  );

  const now = Date.now();
  let removed = 0;
  let freedBytes = 0;
  const survivors: typeof files = [];

  // 1. TTL eviction — drop files untouched for longer than ttlMs.
  for (const f of files) {
    if (opts.ttlMs > 0 && now - f.mtimeMs > opts.ttlMs) {
      if (await tryUnlink(f.path)) {
        removed++;
        freedBytes += f.size;
      }
    } else {
      survivors.push(f);
    }
  }

  // 2. Size-cap eviction — coldest first until the survivors fit in maxBytes.
  let remainingBytes = survivors.reduce((n, f) => n + f.size, 0);
  if (opts.maxBytes > 0 && remainingBytes > opts.maxBytes) {
    survivors.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const f of survivors) {
      if (remainingBytes <= opts.maxBytes) {
        break;
      }
      if (await tryUnlink(f.path)) {
        removed++;
        freedBytes += f.size;
        remainingBytes -= f.size;
      }
    }
  }

  return { scanned: files.length, removed, freedBytes, remainingBytes };
}
