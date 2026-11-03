import type { MailboxSession, OAuthClientConfig } from "./email.types";
import { MicrosoftClient } from "./microsoft.client";
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";

const config: OAuthClientConfig = {
  clientId: "client-id",
  clientSecret: "secret",
  redirectUri: "http://localhost:4101/api/email/oauth/callback",
  tenantId: "11111111-1111-4111-8111-111111111111",
  mailbox: "applications@example.com",
  allowSend: false,
};
const session: MailboxSession = {
  config,
  accessToken: "access",
  refreshToken: "refresh",
  tokenExpiresAt: null,
  historyId: null,
  mailboxId: "applications@example.com",
  deltaLink: null,
};
const message = {
  id: "m1",
  conversationId: "c1",
  subject: "Interview",
  from: { emailAddress: { address: "Hiring@Example.org", name: "Hiring" } },
  body: {
    contentType: "html",
    content: '<p>Hello</p><a href="https://example.org/job">View job</a>',
  },
  bodyPreview: "Hello",
  receivedDateTime: "2026-01-01T12:00:00Z",
};
const delta =
  "https://graph.microsoft.com/v1.0/users/applications%40example.com/mailFolders/inbox/messages/delta?$deltatoken=opaque";
function client(responses: Response[], calls: { url: string; init?: RequestInit }[] = []) {
  return new MicrosoftClient((async (url, init) => {
    if (
      String(url).includes("/mailFolders/inbox?$select=id") &&
      !calls.some((call) => call.url.startsWith("https://login.microsoftonline.com/"))
    )
      return Response.json({ id: "verified-inbox-id" });
    calls.push({ url: String(url), init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  }) as typeof fetch);
}

describe("Microsoft mail", () => {
  beforeEach(() => setSystemTime(new Date("2026-01-02T12:00:00Z")));
  afterEach(() => setSystemTime());
  it("binds Microsoft consent to tenant, PKCE and read-only shared scopes", () => {
    const url = new URL(new MicrosoftClient().authorizeUrl(config, "csrf", "verifier"));
    expect(url.hostname).toBe("login.microsoftonline.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("Mail.Read.Shared");
    expect(url.searchParams.get("scope")).not.toContain("Mail.Send");
    expect(url.searchParams.get("state")).toBe("csrf");
  });
  it("normalizes the chosen shared mailbox into the existing inbox shape", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await client(
      [Response.json({ value: [message], "@odata.deltaLink": delta })],
      calls,
    ).sync(session);
    expect(calls[0].url).toContain(
      "users/applications%40example.com/mailFolders/inbox/messages/delta",
    );
    expect(result.newMessages[0]).toMatchObject({
      providerId: "m1",
      threadId: "c1",
      fromAddress: "hiring@example.org",
      rawBody: "Hello View job",
      links: [{ url: "https://example.org/job", text: "View job" }],
    });
    expect(result.deltaLink).toBe(delta);
    expect(calls[0].init?.redirect).toBe("error");
  });
  it("rejects a foreign delta URL before transmitting a token", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client([], calls).sync({ ...session, deltaLink: "https://attacker.example/steal" }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("rejects a delta URL pointing at another mailbox", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client([], calls).sync({
        ...session,
        deltaLink:
          "https://graph.microsoft.com/v1.0/users/other@example.com/mailFolders/inbox/messages/delta?$deltatoken=x",
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("follows pages, deduplicates messages and ignores deletion markers", async () => {
    const next = delta.replace("$deltatoken=opaque", "$skiptoken=page2");
    const result = await client([
      Response.json({ value: [message], "@odata.nextLink": next }),
      Response.json({
        value: [message, { id: "gone", "@removed": { reason: "deleted" } }],
        "@odata.deltaLink": delta,
      }),
    ]).sync(session);
    expect(result.newMessages).toHaveLength(1);
    expect(result.deltaLink).toBe(delta);
  });
  it("refuses a partial import rather than advancing its cursor", async () => {
    await expect(
      client([
        Response.json({ value: [message], "@odata.nextLink": delta }),
        new Response("denied", { status: 403 }),
      ]).sync(session),
    ).rejects.toThrow();
  });
  it("restarts an expired delta cursor without losing duplicate protection", async () => {
    const result = await client([
      new Response(null, { status: 410 }),
      Response.json({ value: [message], "@odata.deltaLink": delta }),
    ]).sync({ ...session, deltaLink: delta });
    expect(result.newMessages[0].providerId).toBe("m1");
  });
  it("does not replace an inaccessible shared inbox with the personal mailbox", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client(
        [
          Response.json({
            access_token: "a",
            refresh_token: "r",
            expires_in: 3600,
            scope: "User.Read Mail.Read.Shared",
          }),
          Response.json({ mail: "owner@example.com", userPrincipalName: "owner@example.com" }),
          new Response(null, { status: 403 }),
        ],
        calls,
      ).exchangeCode(config, "code", "verifier"),
    ).rejects.toThrow();
    expect(calls).toHaveLength(3);
    expect(calls[2].url).toContain("applications%40example.com");
  });
  it("refuses sending from a read-only session without calling Graph", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client([], calls).send(session, {
        to: "recruiter@example.org",
        subject: "Reply",
        body: "Hello",
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("honors a zero Retry-After and bounds repeated throttling", async () => {
    const calls: { url: string }[] = [];
    const limited = () => new Response(null, { status: 429, headers: { "Retry-After": "0" } });
    await expect(client([limited(), limited(), limited()], calls).sync(session)).rejects.toThrow();
    expect(calls).toHaveLength(3);
  });
  it("bounds initial sync to the recent-mail window", async () => {
    const calls: { url: string }[] = [];
    await client([Response.json({ value: [], "@odata.deltaLink": delta })], calls).sync(session);
    expect(new URL(calls[0].url).searchParams.get("$filter")).toBe(
      "receivedDateTime ge 2025-12-19T12:00:00.000Z",
    );
  });
  it("does not retry a send when its acceptance is uncertain", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client([new Response(null, { status: 503 })], calls).send(
        {
          ...session,
          config: { ...config, allowSend: true },
          scope: "Mail.Read.Shared Mail.Send.Shared",
        },
        { to: "recruiter@example.org", subject: "Reply", body: "Hello" },
      ),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
  it("requires a granted send scope even when sending was requested", async () => {
    const calls: { url: string }[] = [];
    await expect(
      client([], calls).send(
        { ...session, config: { ...config, allowSend: true }, scope: "Mail.Read.Shared" },
        { to: "recruiter@example.org", subject: "Reply", body: "Hello" },
      ),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it("refreshes tokens using the fixed tenant authority", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await client(
      [
        Response.json({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
          scope: "Mail.Read.Shared",
        }),
      ],
      calls,
    ).refresh(config, "old-refresh");
    expect(result.accessToken).toBe("new-access");
    expect(result.refreshToken).toBe("new-refresh");
    expect(new URL(calls[0].url).pathname).toBe(
      "/11111111-1111-4111-8111-111111111111/oauth2/v2.0/token",
    );
    expect(new URLSearchParams(calls[0].init?.body as string).get("refresh_token")).toBe(
      "old-refresh",
    );
  });
  it("imports plain-text bodies and their job links", async () => {
    const plain = {
      ...message,
      body: {
        contentType: "text",
        content: "Interview invitation\nhttps://example.org/job View job",
      },
    };
    const result = await client([
      Response.json({ value: [plain], "@odata.deltaLink": delta }),
    ]).sync(session);
    expect(result.newMessages[0].rawBody).toContain("Interview invitation");
    expect(result.newMessages[0].links).toEqual([
      { url: "https://example.org/job", text: "View job" },
    ]);
  });
  it("does not let a quoted SMTP sender poison the inbox sync", async () => {
    const quoted = {
      ...message,
      from: { emailAddress: { address: '"quoted user"@example.org', name: "Sender" } },
    };
    const result = await client([
      Response.json({ value: [quoted], "@odata.deltaLink": delta }),
    ]).sync(session);
    expect(result.newMessages[0].fromAddress).toBe('"quoted user"@example.org');
    expect(result.deltaLink).toBe(delta);
  });
  it("accepts Microsoft's shared-inbox OData continuation links", async () => {
    const canonical =
      "https://graph.microsoft.com/v1.0/users/applications@example.com/mailFolders('verified-inbox-id')/messages/delta?$skiptoken=opaque";
    const final = canonical.replace("$skiptoken=opaque", "$deltatoken=finished");
    const result = await client([
      Response.json({ value: [message], "@odata.nextLink": canonical }),
      Response.json({ value: [], "@odata.deltaLink": final }),
    ]).sync(session);
    expect(result.newMessages).toHaveLength(1);
    expect(result.deltaLink).toBe(final);
  });
  it("resumes the saved canonical shared-inbox cursor", async () => {
    const canonical =
      "https://graph.microsoft.com/v1.0/users('applications%40example.com')/mailfolders('verified-inbox-id')/messages/delta?$deltatoken=opaque";
    const result = await client([Response.json({ value: [], "@odata.deltaLink": canonical })]).sync(
      { ...session, deltaLink: canonical },
    );
    expect(result.deltaLink).toBe(canonical);
  });
  it("refuses a continuation link for another folder in the same mailbox", async () => {
    const wrong =
      "https://graph.microsoft.com/v1.0/users/applications@example.com/mailFolders('other-folder-id')/messages/delta?$skiptoken=opaque";
    const calls: { url: string }[] = [];
    await expect(
      client([Response.json({ value: [], "@odata.nextLink": wrong })], calls).sync(session),
    ).rejects.toThrow(/cursor/);
    expect(calls).toHaveLength(1);
  });
  it("uses a page-size preference without capping the initial delta result set", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    await client([Response.json({ value: [], "@odata.deltaLink": delta })], calls).sync(session);
    expect(new URL(calls[0].url).searchParams.has("$top")).toBe(false);
    expect(new Headers(calls[0].init?.headers).get("Prefer")).toContain("odata.maxpagesize=50");
  });
});
