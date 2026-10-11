import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/common/utils/slug";
import { env } from "@/env";

const STORAGE_ROOT = path.resolve(env.STORAGE_ROOT);
const RESUMES_DIR = path.join(STORAGE_ROOT, "resumes");
const GENERATED_DIR = path.join(STORAGE_ROOT, "resumes-generated");
// Bump when PDF rendering changes so previously cached PDFs are regenerated
// after a deployment even if a resume has not been edited.
const PDF_RENDER_VERSION = "unicode-v1";

export function resumePath(filename: string): string {
  return path.join(RESUMES_DIR, filename);
}

export function generatedResumePath(id: string, updatedAtMs: number): string {
  return path.join(GENERATED_DIR, `master-${id}-${updatedAtMs}-${PDF_RENDER_VERSION}.pdf`);
}

export function generatedVariantPath(variantId: string, createdAtMs: number): string {
  return path.join(GENERATED_DIR, `variant-${variantId}-${createdAtMs}-${PDF_RENDER_VERSION}.pdf`);
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

/** Unlinks files in a directory matching any of the prefixes plus the suffix, in one scan. */
async function unlinkMatching(dir: string, prefixes: string[], suffix: string): Promise<void> {
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
      .filter((name) => name.endsWith(suffix) && prefixes.some((p) => name.startsWith(p)))
      .map((name) => tryUnlink(path.join(dir, name))),
  );
}

function deleteGeneratedResumeFiles(resumeId: string): Promise<void> {
  return unlinkMatching(GENERATED_DIR, [`master-${resumeId}-`], ".pdf");
}

/** Takes every id at once: one call per variant would re-scan the shared cache dir each time. */
export function deleteGeneratedVariantFiles(...variantIds: string[]): Promise<void> {
  return unlinkMatching(
    GENERATED_DIR,
    variantIds.map((id) => `variant-${id}-`),
    ".pdf",
  );
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
    deleteGeneratedResumeFiles(resumeId),
    deleteGeneratedVariantFiles(...variantIds),
  ]);
}

/** Writes an uploaded resume under a fresh name and returns that name. */
export async function saveResumeSource(file: File): Promise<string> {
  const ext = path.extname(file.name) || ".pdf";
  const slug = slugify(path.basename(file.name, ext), { fallback: "resume" });
  const filename = `${slug}-${Date.now()}${ext}`;
  await mkdir(RESUMES_DIR, { recursive: true });
  await writeFile(resumePath(filename), Buffer.from(await file.arrayBuffer()));
  return filename;
}

/** Streams a file inline. Rejects when the file is missing. */
export async function streamFile(
  filePath: string,
  mime: string,
  downloadName: string,
): Promise<Response> {
  const stats = await stat(filePath);
  return new Response(createReadStream(filePath) as unknown as ReadableStream, {
    headers: {
      "content-type": mime,
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${downloadName}"`,
    },
  });
}

export function slugifyForDownload(label: string): string {
  return slugify(label, { fallback: "resume" });
}

/**
 * Serves the PDF cached at `cachePath`, rendering it on a miss. A hit bumps the mtime, so the prune
 * sweep measures idleness from the last download rather than the last render.
 */
export async function serveCachedPdf(
  cachePath: string,
  render: () => Promise<Buffer>,
  label: string,
): Promise<Response> {
  try {
    const now = new Date();
    await utimes(cachePath, now, now);
  } catch {
    await mkdir(GENERATED_DIR, { recursive: true });
    await writeFile(cachePath, await render());
  }
  return streamFile(cachePath, "application/pdf", `${slugifyForDownload(label)}.pdf`);
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
 * stage. Safe to run repeatedly - every evicted file is re-rendered on next download.
 */
interface CachePruneOptions {
  ttlMs: number;
  maxBytes: number;
}

export async function pruneGeneratedCache(opts: CachePruneOptions): Promise<CachePruneResult> {
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

  // 1. TTL eviction - drop files untouched for longer than ttlMs.
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

  // 2. Size-cap eviction - coldest first until the survivors fit in maxBytes.
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
