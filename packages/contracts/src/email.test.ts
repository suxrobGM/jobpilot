import { oauthClientUpsertSchema } from "./email";
import { describe, expect, it } from "bun:test";

describe("mailbox OAuth configuration", () => {
  it("preserves existing Gmail client input", () => {
    expect(
      oauthClientUpsertSchema.parse({ clientId: "google", clientSecret: "secret" }).provider,
    ).toBe("gmail");
  });
  it("requires a tenant for Microsoft instead of accepting arbitrary authorities", () => {
    expect(
      oauthClientUpsertSchema.safeParse({
        provider: "microsoft",
        clientId: "client",
        tenantId: "https://attacker.example",
      }).success,
    ).toBe(false);
    expect(
      oauthClientUpsertSchema.safeParse({ provider: "microsoft", clientId: "client" }).success,
    ).toBe(false);
  });
  it("defaults Microsoft to read-only and accepts a shared-mailbox address", () => {
    const result = oauthClientUpsertSchema.parse({
      provider: "microsoft",
      clientId: "client",
      tenantId: "11111111-1111-4111-8111-111111111111",
      mailbox: "applications@example.org",
    });
    expect(result.allowSend).toBe(false);
    expect(result.mailbox).toBe("applications@example.org");
  });
});
