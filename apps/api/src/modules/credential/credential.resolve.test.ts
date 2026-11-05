// The login precedence skills rely on: the board's own credential beats the default, and an
// incomplete pair (no password) is skipped rather than returned.

import type { CryptoService } from "@/common/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { JobBoardService } from "@/modules/job-board/job-board.service";
import { CredentialService } from "./credential.service";
import { describe, expect, it } from "bun:test";

interface Row {
  id: string;
  kind: "board" | "default";
  boardId: string | null;
  email: string | null;
  password: string | null;
}

const LINKEDIN = { id: "b-li", domain: "linkedin.com", name: "LinkedIn" };

function makeService(rows: Row[]) {
  const db = {
    credential: {
      findMany: async ({ where }: { where: { OR: Partial<Row>[] } }) =>
        rows.filter((r) =>
          where.OR.some((clause) => r.kind === clause.kind || r.boardId === clause.boardId),
        ),
    },
  } as unknown as PrismaClient;
  const crypto = {
    decryptFor: async (_user: string, _ctx: string, blob: string) => blob.replace("enc:", ""),
  } as unknown as CryptoService;
  const boards = {
    find: async (domain: string) => (domain === "linkedin.com" ? LINKEDIN : null),
  } as unknown as JobBoardService;
  return new CredentialService(db, crypto, boards);
}

const defaultLogin: Row = {
  id: "c-default",
  kind: "default",
  boardId: null,
  email: "me@x.io",
  password: "enc:pw0",
};

describe("CredentialService.resolveCredential", () => {
  it("prefers the board's credential over default and returns its id", async () => {
    const svc = makeService([
      defaultLogin,
      { id: "c-li", kind: "board", boardId: "b-li", email: "li@x.io", password: "enc:pw1" },
    ]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toEqual({
      id: "c-li",
      email: "li@x.io",
      password: "pw1",
      kind: "board",
    });
  });

  it("falls back to default when the board credential has no password", async () => {
    const svc = makeService([
      defaultLogin,
      { id: "c-li", kind: "board", boardId: "b-li", email: "li@x.io", password: null },
    ]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toMatchObject({
      id: "c-default",
      kind: "default",
    });
  });

  it("uses the default for a board the catalog has never seen", async () => {
    const svc = makeService([defaultLogin]);
    expect(await svc.resolveCredential("u1", "unknown.io")).toMatchObject({ id: "c-default" });
  });

  it("returns null when nothing matches", async () => {
    const svc = makeService([
      { id: "c", kind: "board", boardId: "b-indeed", email: "a", password: "enc:b" },
    ]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toBeNull();
  });
});
