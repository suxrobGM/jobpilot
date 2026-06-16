import { findOwned } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Fetch a resume owned by the profile (throws 404 otherwise). Shared by the
 * core, file, and variant services so none has to inject another. */
export function findResume(prisma: PrismaClient, profileId: number, id: number) {
  return findOwned((where) => prisma.resume.findFirst({ where }), { id, profileId }, "Resume");
}
