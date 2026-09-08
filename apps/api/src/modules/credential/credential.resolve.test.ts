// The login precedence skills rely on: a credential scoped to the domain beats "default", and
// an incomplete pair (no password) is skipped rather than returned.

import type { CryptoService } from "@/common/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { CredentialService } from "./credential.service";
import { describe, expect, it } from "bun:test";

interface Row {
  id: string;
  scope: string;
  email: string | null;
  password: string | null;
}

function makeService(rows: Row[]) {
  const db = {
    credential: {
      findMany: async ({ where }: { where: { scope: { in: string[] } } }) =>
        rows.filter((r) => where.scope.in.includes(r.scope)),
    },
  } as unknown as PrismaClient;
  const crypto = {
    decryptFor: async (_user: string, _ctx: string, blob: string) => blob.replace("enc:", ""),
  } as unknown as CryptoService;
  return new CredentialService(db, crypto);
}

describe("CredentialService.resolveCredential", () => {
  it("prefers the domain-scoped credential over default and returns its id", async () => {
    const svc = makeService([
      { id: "c-default", scope: "default", email: "me@x.io", password: "enc:pw0" },
      { id: "c-li", scope: "linkedin.com", email: "li@x.io", password: "enc:pw1" },
    ]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toEqual({
      id: "c-li",
      email: "li@x.io",
      password: "pw1",
      scope: "linkedin.com",
    });
  });

  it("falls back to default when the domain credential has no password", async () => {
    const svc = makeService([
      { id: "c-default", scope: "default", email: "me@x.io", password: "enc:pw0" },
      { id: "c-li", scope: "linkedin.com", email: "li@x.io", password: null },
    ]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toMatchObject({
      id: "c-default",
      scope: "default",
    });
  });

  it("returns null when nothing matches", async () => {
    const svc = makeService([{ id: "c", scope: "indeed.com", email: "a", password: "enc:b" }]);
    expect(await svc.resolveCredential("u1", "linkedin.com")).toBeNull();
  });
});
