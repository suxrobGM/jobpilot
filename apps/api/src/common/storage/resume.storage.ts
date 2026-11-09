import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { slugify } from "@/common/utils/slug";

/** Absolute directory holding uploaded and generated resumes. */
export const STORAGE_ROOT = new InjectionToken<string>("STORAGE_ROOT");

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

interface ResumeArtifactRefs {
  id: string;
  sourceFilename: string | null;
  variants: { id: string }[];
}

const masterPrefix = (resumeId: string) => `master-${resumeId}-`;
const variantPrefix = (variantId: string) => `variant-${variantId}-`;

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

export interface CachePruneResult {
  scanned: number;
  removed: number;
  freedBytes: number;
  remainingBytes: number;
}

interface CachePruneOptions {
  ttlMs: number;
  maxBytes: number;
}

@injectable()
export class ResumeStorage {
  private readonly resumesDir: string;
  private readonly generatedDir: string;

  constructor(root: string = inject(STORAGE_ROOT)) {
    this.resumesDir = path.join(root, "resumes");
    this.generatedDir = path.join(root, "resumes-generated");
  }

  resumePath(filename: string): string {
    return path.join(this.resumesDir, filename);
  }

  generatedResumePath(id: string, updatedAtMs: number): string {
    return path.join(this.generatedDir, `${masterPrefix(id)}${updatedAtMs}.pdf`);
  }

  generatedVariantPath(variantId: string, createdAtMs: number): string {
    return path.join(this.generatedDir, `${variantPrefix(variantId)}${createdAtMs}.pdf`);
  }

  async deleteResumeFile(filename: string): Promise<void> {
    await tryUnlink(this.resumePath(filename));
  }

  /** Takes every id at once: one call per variant would re-scan the shared cache dir each time. */
  deleteGeneratedVariantFiles(...variantIds: string[]): Promise<void> {
    return unlinkMatching(this.generatedDir, variantIds.map(variantPrefix), ".pdf");
  }

  /** One cache-dir scan for every resume, so deleting an account doesn't re-scan per resume. */
  async deleteAllResumeArtifacts(resumes: ResumeArtifactRefs[]): Promise<void> {
    const sourceFiles = resumes.flatMap((r) => (r.sourceFilename ? [r.sourceFilename] : []));
    const generatedPrefixes = resumes.flatMap((r) => [
      masterPrefix(r.id),
      ...r.variants.map((v) => variantPrefix(v.id)),
    ]);
    await Promise.all([
      ...sourceFiles.map((filename) => this.deleteResumeFile(filename)),
      unlinkMatching(this.generatedDir, generatedPrefixes, ".pdf"),
    ]);
  }

  /** Writes an uploaded resume under a fresh name and returns that name. */
  async saveResumeSource(file: File): Promise<string> {
    const ext = path.extname(file.name) || ".pdf";
    const slug = slugify(path.basename(file.name, ext), { fallback: "resume" });
    const filename = `${slug}-${Date.now()}${ext}`;
    await mkdir(this.resumesDir, { recursive: true });
    await writeFile(this.resumePath(filename), Buffer.from(await file.arrayBuffer()));
    return filename;
  }

  /**
   * Serves the PDF cached at `cachePath`, rendering it on a miss. A hit bumps the mtime, so the prune
   * sweep measures idleness from the last download rather than the last render.
   */
  async serveCachedPdf(
    cachePath: string,
    render: () => Promise<Buffer>,
    label: string,
  ): Promise<Response> {
    try {
      const now = new Date();
      await utimes(cachePath, now, now);
    } catch {
      await mkdir(this.generatedDir, { recursive: true });
      // Rename is atomic, so a concurrent request never streams a half-written PDF.
      const tempPath = `${cachePath}.tmp-${crypto.randomUUID()}`;
      await writeFile(tempPath, await render());
      await rename(tempPath, cachePath);
    }
    return streamFile(cachePath, "application/pdf", `${slugifyForDownload(label)}.pdf`);
  }

  /**
   * Prunes the generated-PDF cache so it can't fill the disk: first evicts files idle
   * longer than `ttlMs`, then, if the survivors still exceed `maxBytes`, evicts coldest
   * (oldest mtime) first until under the cap. A `ttlMs`/`maxBytes` of 0 disables that
   * stage. Safe to run repeatedly - every evicted file is re-rendered on next download.
   */
  async pruneGeneratedCache(opts: CachePruneOptions): Promise<CachePruneResult> {
    let names: string[];
    try {
      names = await readdir(this.generatedDir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return { scanned: 0, removed: 0, freedBytes: 0, remainingBytes: 0 };
      }
      throw e;
    }

    const files: { path: string; size: number; mtimeMs: number }[] = [];
    await Promise.all(
      names.map(async (name) => {
        const filePath = path.join(this.generatedDir, name);
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
}
