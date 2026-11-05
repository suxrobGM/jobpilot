import type { CryptoService } from "@/common/crypto";
import { forbidden } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailProviders } from "../email-provider";
import { EmailAccountService } from "./account.service";
import type { MailboxSessionService } from "./mailbox-session.service";
import { describe, expect, it } from "bun:test";

const config = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "http://localhost/callback",
  tenantId: "11111111-1111-4111-8111-111111111111",
  mailbox: "applications@example.org",
  allowSend: false,
};
function setup(active: Record<string, unknown> | null = null) {
  const writes: unknown[] = [];
  let exchanges = 0;
  const prisma = {
    emailAccount: {
      findUnique: async () => active,
      create: async (arg: unknown) => {
        writes.push(arg);
      },
      update: async (arg: unknown) => {
        writes.push(arg);
      },
    },
    emailOAuthClient: { findUnique: async () => null },
  } as unknown as PrismaClient;
  const crypto = {
    encryptFor: async (_u: string, _c: string, v: string) => `encrypted:${v}`,
    encryptField: async (_u: string, _c: string, v?: string) => (v ? `encrypted:${v}` : null),
  } as unknown as CryptoService;
  const sessions = { resolveOAuthClient: async () => config } as unknown as MailboxSessionService;
  const providers = {
    authorizeUrl: () => "https://login.microsoftonline.com/authorize",
    exchangeCode: async () => {
      exchanges++;
      return {
        email: "applications@example.org",
        signedInEmail: "owner@example.org",
        mailboxId: "applications@example.org",
        tokens: { accessToken: "access", refreshToken: "refresh", scope: "Mail.Read.Shared" },
      };
    },
  } as unknown as EmailProviders;
  return {
    service: new EmailAccountService(prisma, crypto, sessions, providers),
    writes,
    exchanges: () => exchanges,
    providers,
  };
}

describe("mailbox provider connection", () => {
  it("refuses a different provider while a mailbox is connected", async () => {
    const { service } = setup({ provider: "gmail" });
    await expect(service.buildAuthorizeUrl("user", "microsoft")).rejects.toThrow(/Disconnect/);
  });
  it("rejects config substitution before exchanging an OAuth code", async () => {
    const { service, exchanges, writes } = setup();
    await expect(
      service.completeEmailOAuth("user", "code", "microsoft", "verifier", "tampered"),
    ).rejects.toThrow();
    expect(exchanges()).toBe(0);
    expect(writes).toHaveLength(0);
  });
  it("persists shared mailbox and signed-in identity separately with encrypted tokens", async () => {
    const { service, writes } = setup();
    const flow = await service.buildAuthorizeUrl("user", "microsoft");
    await service.completeEmailOAuth("user", "code", "microsoft", flow.verifier, flow.configHash);
    expect(writes).toEqual([
      {
        data: {
          userId: "user",
          provider: "microsoft",
          email: "applications@example.org",
          signedInEmail: "owner@example.org",
          mailboxId: "applications@example.org",
          accessToken: "encrypted:access",
          refreshToken: "encrypted:refresh",
          tokenExpiresAt: null,
          scope: "Mail.Read.Shared",
          refreshFailedAt: null,
        },
      },
    ]);
  });
  it("requires disconnect before changing the connected shared mailbox", async () => {
    const { service, writes } = setup({
      id: "a",
      provider: "microsoft",
      email: "other@example.org",
      signedInEmail: "owner@example.org",
    });
    const flow = await service.buildAuthorizeUrl("user", "microsoft");
    await expect(
      service.completeEmailOAuth("user", "code", "microsoft", flow.verifier, flow.configHash),
    ).rejects.toThrow(/Disconnect/);
    expect(writes).toHaveLength(0);
  });
  it("reports read-only when Microsoft sending is disabled in settings", async () => {
    const { service } = setup({
      provider: "microsoft",
      email: "applications@example.org",
      signedInEmail: "owner@example.org",
      mailboxId: "applications@example.org",
      scope: "Mail.Read.Shared Mail.Send.Shared",
      lastSyncAt: null,
      refreshFailedAt: null,
    });
    expect((await service.accountStatus("user")).canSend).toBe(false);
  });
  it("surfaces delegated mailbox denial as a specific connection failure", async () => {
    const { service, providers } = setup();
    providers.exchangeCode = async () => {
      throw forbidden("Mailbox denied");
    };
    const flow = await service.buildAuthorizeUrl("user", "microsoft");
    await expect(
      service.completeEmailOAuth("user", "code", "microsoft", flow.verifier, flow.configHash),
    ).rejects.toMatchObject({ reason: "mailbox_access_denied" });
  });
});
