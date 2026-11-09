// SecurityService.deleteAccount against a fake Prisma and a temp storage dir - no database.
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashPassword } from "@/common/auth";
import { ResumeStorage } from "@/common/storage/resume.storage";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AuthTokenService } from "./auth-token.service";
import { SecurityService } from "./security.service";
import type { VerificationService } from "./verification.service";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "jobpilot-delete-"));
  await mkdir(path.join(root, "resumes"));
  await mkdir(path.join(root, "resumes-generated"));
  await Promise.all([
    writeFile(path.join(root, "resumes", "mine.pdf"), ""),
    writeFile(path.join(root, "resumes", "other.pdf"), ""),
    writeFile(path.join(root, "resumes-generated", "master-r1-1.pdf"), ""),
    writeFile(path.join(root, "resumes-generated", "variant-v1-1.pdf"), ""),
    writeFile(path.join(root, "resumes-generated", "master-r2-1.pdf"), ""),
  ]);
});

afterEach(() => rm(root, { recursive: true, force: true }));

async function make(role: string) {
  const deletes: unknown[] = [];
  const user = {
    role,
    passwordHash: await hashPassword("correct-password"),
    resumes: [{ id: "r1", sourceFilename: "mine.pdf", variants: [{ id: "v1" }] }],
  };
  const prisma = {
    user: {
      findUnique: async () => user,
      delete: async (args: unknown) => {
        deletes.push(args);
        return {};
      },
    },
  } as unknown as PrismaClient;
  const service = new SecurityService(
    prisma,
    {} as VerificationService,
    {} as AuthTokenService,
    new ResumeStorage(root),
  );
  return { service, deletes };
}

describe("SecurityService.deleteAccount", () => {
  it("keeps the account on a wrong password", async () => {
    const { service, deletes } = await make("user");
    await expect(service.deleteAccount("u1", { currentPassword: "wrong" })).rejects.toThrow();
    expect(deletes).toEqual([]);
  });

  it("refuses to delete the super admin", async () => {
    const { service, deletes } = await make("super_admin");
    await expect(
      service.deleteAccount("u1", { currentPassword: "correct-password" }),
    ).rejects.toThrow();
    expect(deletes).toEqual([]);
  });

  it("deletes the user and only that user's resume files", async () => {
    const { service, deletes } = await make("user");
    await service.deleteAccount("u1", { currentPassword: "correct-password" });

    expect(deletes).toEqual([{ where: { id: "u1" } }]);
    expect(await readdir(path.join(root, "resumes"))).toEqual(["other.pdf"]);
    expect(await readdir(path.join(root, "resumes-generated"))).toEqual(["master-r2-1.pdf"]);
  });
});
