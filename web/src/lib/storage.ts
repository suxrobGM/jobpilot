import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");
const RESUMES_DIR = path.join(STORAGE_ROOT, "resumes");

export async function ensureResumesDir(): Promise<string> {
  await mkdir(RESUMES_DIR, { recursive: true });
  return RESUMES_DIR;
}

export function resumePath(filename: string): string {
  return path.join(RESUMES_DIR, filename);
}

export async function deleteResumeFile(filename: string): Promise<void> {
  try {
    await unlink(resumePath(filename));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export function generateResumeFilename(originalName: string): string {
  const ext = path.extname(originalName) || ".pdf";
  const slug =
    path
      .basename(originalName, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "resume";
  return `${Date.now()}-${slug}${ext}`;
}
