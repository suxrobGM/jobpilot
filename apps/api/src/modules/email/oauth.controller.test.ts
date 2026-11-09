import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { AuthTokenService } from "@/modules/auth/auth-token.service";
import { EmailAccountService } from "./account/account.service";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

const principal = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "USER",
  email: "user@example.org",
  tokenId: "22222222-2222-4222-8222-222222222222",
  tokenKind: "session" as const,
};
const state = "synthetic-state";
const verifier = "v".repeat(43);
const configHash = "h".repeat(64);
let sessionId = principal.tokenId;
const completions: unknown[][] = [];
const account = container.get(EmailAccountService);
const tokens = container.get(AuthTokenService);
const { emailOAuthController } = await import("./oauth.controller");
const spies: Array<{ mockRestore: () => void }> = [];
const app = new Elysia().group("/api", (api) => api.use(emailOAuthController));
const headers = { authorization: "Bearer synthetic-session", "x-jobpilot-version": "2.4.2" };
async function start(provider = "microsoft"): Promise<string> {
  const response = await app.handle(
    new Request(`http://localhost/api/email/oauth/authorize?provider=${provider}`, { headers }),
  );
  expect(response.status).toBe(302);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}
async function callback(cookie: string, returnedState = state): Promise<Response> {
  return app.handle(
    new Request(
      `http://localhost/api/email/oauth/callback?code=synthetic-code&state=${returnedState}`,
      { headers: { ...headers, cookie } },
    ),
  );
}
describe("mailbox OAuth cookie round trip", () => {
  beforeEach(() => {
    sessionId = principal.tokenId;
    completions.length = 0;
    spies.push(
      spyOn(tokens, "verify").mockImplementation(async () => ({
        ...principal,
        tokenId: sessionId,
      })),
    );
    spies.push(
      spyOn(account, "buildAuthorizeUrl").mockResolvedValue({
        authorizeUrl: "https://login.microsoftonline.com/authorize",
        state,
        verifier,
        configHash,
      }),
    );
    spies.push(
      spyOn(account, "completeEmailOAuth").mockImplementation(async (...args) => {
        completions.push(args);
        return { email: "applications@example.org" };
      }),
    );
  });
  afterEach(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
    spies.length = 0;
  });
  it("returns Microsoft callback context intact through HTTP cookies", async () => {
    const response = await callback(await start());
    expect(response.headers.get("location")).toContain("emailConnect=ok");
    expect(completions).toEqual([
      [principal.id, "synthetic-code", "microsoft", verifier, configHash],
    ]);
  });
  it("preserves the Gmail callback through the same cookie binding", async () => {
    const response = await callback(await start("gmail"));
    expect(response.headers.get("location")).toContain("emailConnect=ok");
    expect(completions[0][2]).toBe("gmail");
  });
  it("rejects a changed state without exchanging the code", async () => {
    const response = await callback(await start(), "wrong-state");
    expect(response.headers.get("location")).toContain("reason=invalid_callback");
    expect(completions).toHaveLength(0);
  });
  it("rejects a callback from a different login session", async () => {
    const cookie = await start();
    sessionId = "33333333-3333-4333-8333-333333333333";
    const response = await callback(cookie);
    expect(response.headers.get("location")).toContain("reason=invalid_callback");
    expect(completions).toHaveLength(0);
  });
});
