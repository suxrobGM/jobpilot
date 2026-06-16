import { mkdir, readdir, unlink } from "node:fs/promises";
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

export async function deleteResumeFile(filename: string): Promise<void> {
  try {
    await unlink(resumePath(filename));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
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
      .map(async (name) => {
        try {
          await unlink(path.join(dir, name));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
            throw e;
          }
        }
      }),
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
