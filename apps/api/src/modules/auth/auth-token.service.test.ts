// AuthTokenService against a fake Prisma - no database. Covers what each request relies on: a dead
// token never authenticates, and revocation scopes match the flows that call them.
import { hashToken } from "@/common/auth/tokens";
import type { CryptoService } from "@/common/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { AuthTokenService } from "./auth-token.service";
import { describe, expect, it } from "bun:test";

const NOW = Date.now();
const USER = { id: "u1", role: "user", email: "u1@example.com" };

interface Row {
  id: string;
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

function make(row: Partial<Row> | null) {
  const updates: unknown[] = [];
  const revocations: unknown[] = [];
  const stored: Row | null = row && {
    id: "t1",
    tokenHash: hashToken("raw"),
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    ...row,
  };
  const prisma = {
    authToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        stored && stored.tokenHash === where.tokenHash ? { ...stored, user: USER } : null,
      update: async (args: unknown) => {
        updates.push(args);
        return {};
      },
      updateMany: (args: unknown) => {
        revocations.push(args);
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaClient;
  const service = new AuthTokenService(prisma, {} as CryptoService);
  return { service, updates, revocations };
}

describe("AuthTokenService.verify", () => {
  it("returns the principal with the authenticating token id", async () => {
    const { service } = make({});
    expect(await service.verify("raw")).toEqual({ ...USER, tokenId: "t1" });
  });

  it("rejects an unknown token", async () => {
    const { service } = make({});
    expect(await service.verify("other")).toBeNull();
  });

  it("rejects a revoked token", async () => {
    const { service } = make({ revokedAt: new Date(NOW - 1000) });
    expect(await service.verify("raw")).toBeNull();
  });

  it("rejects an expired session", async () => {
    const { service } = make({ expiresAt: new Date(NOW - 1000) });
    expect(await service.verify("raw")).toBeNull();
  });

  it("stamps lastUsedAt only once per throttle window", async () => {
    const fresh = make({ lastUsedAt: new Date(NOW - 60_000) });
    await fresh.service.verify("raw");
    expect(fresh.updates).toHaveLength(0);

    const stale = make({ lastUsedAt: new Date(NOW - 10 * 60_000) });
    await stale.service.verify("raw");
    expect(stale.updates).toHaveLength(1);
  });
});

describe("AuthTokenService revocation", () => {
  it("revokeSessions spares the terminal token and the current session", async () => {
    const { service, revocations } = make(null);
    await service.revokeSessions("u1", "current");
    expect(revocations[0]).toMatchObject({
      where: { userId: "u1", kind: "session", revokedAt: null, id: { not: "current" } },
    });
  });

  it("revokeAll covers every kind", async () => {
    const { service, revocations } = make(null);
    await service.revokeAll("u1");
    expect(revocations[0]).toEqual({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
