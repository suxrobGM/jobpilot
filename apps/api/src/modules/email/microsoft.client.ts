import { createHash } from "node:crypto";
import type { EmailConnectErrorReason } from "@jobpilot/contracts/email";
import { injectable } from "@needle-di/core";
import { z } from "zod/v4";
import { OAuthFlowError } from "@/common/auth/oauth-flow";
import {
  badGateway,
  forbidden,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/common/errors";
import type {
  ExchangedCode,
  MailboxSession,
  NormalizedMessage,
  OAuthClientConfig,
  SendMessageInput,
  SentMessage,
  SyncResult,
  TokenSet,
} from "./email.types";
import {
  buildMimeMessage,
  emailDomain,
  encodeBase64Url,
  extractLinks,
  extractPlainText,
  stripQuotedReplies,
} from "./email.utils";

const GRAPH = "https://graph.microsoft.com/v1.0";
const identitySchema = z.object({ mail: z.email().nullable(), userPrincipalName: z.email() });
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().positive(),
  scope: z.string(),
});
const messageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().optional(),
  subject: z.string().default(""),
  from: z
    .object({ emailAddress: z.object({ address: z.string(), name: z.string().optional() }) })
    .nullish(),
  body: z.object({ contentType: z.enum(["html", "text"]), content: z.string() }).optional(),
  bodyPreview: z.string().default(""),
  receivedDateTime: z.iso.datetime({ offset: true }),
});
const pageSchema = z.object({
  value: z.array(z.unknown()),
  "@odata.nextLink": z.string().optional(),
  "@odata.deltaLink": z.string().optional(),
});

function hasScope(scope: string | null | undefined, name: string): boolean {
  return !!scope
    ?.split(/\s+/)
    .some(
      (s) =>
        s.toLowerCase() === name.toLowerCase() ||
        s.toLowerCase() === `https://graph.microsoft.com/${name}`.toLowerCase(),
    );
}

export function microsoftScopes(config: OAuthClientConfig): string[] {
  const scopes = [
    "openid",
    "email",
    "offline_access",
    "User.Read",
    config.mailbox ? "Mail.Read.Shared" : "Mail.Read",
  ];
  if (config.allowSend) {
    scopes.push(config.mailbox ? "Mail.Send.Shared" : "Mail.Send");
  }
  return scopes;
}

export function microsoftCanRead(scope: string | null | undefined, shared: boolean): boolean {
  if (shared) {
    return hasScope(scope, "Mail.Read.Shared") || hasScope(scope, "Mail.ReadWrite.Shared");
  }
  return hasScope(scope, "Mail.Read") || hasScope(scope, "Mail.ReadWrite");
}

export function microsoftCanSend(scope: string | null | undefined, shared: boolean): boolean {
  return hasScope(scope, shared ? "Mail.Send.Shared" : "Mail.Send");
}

function authority(config: OAuthClientConfig): string {
  return `https://login.microsoftonline.com/${z.uuid().parse(config.tenantId)}/oauth2/v2.0`;
}

function mailboxPath(mailboxId: string | null | undefined): string {
  return mailboxId ? `/users/${encodeURIComponent(mailboxId)}` : "/me";
}

function deltaPath(session: MailboxSession): string {
  return `${mailboxPath(session.mailboxId)}/mailFolders/inbox/messages/delta`;
}

function deltaTarget(url: string, session: MailboxSession): { url: string; folder: string } {
  try {
    const target = new URL(url);
    if (
      target.origin !== "https://graph.microsoft.com" ||
      target.username ||
      target.password ||
      target.hash
    ) {
      throw new Error("Invalid origin");
    }
    // Graph canonicalizes Inbox aliases into OData folder IDs on continuation links.
    const pathname = target.pathname.replace(
      /\('((?:[^']|'')*)'\)/g,
      (_, id: string) => `/${encodeURIComponent(decodeURIComponent(id).replace(/''/g, "'"))}`,
    );
    const match = pathname.match(
      /^\/v1\.0\/(me|users\/[^/]+)\/mailfolders\/([^/]+)\/messages\/delta$/i,
    );
    const expected = session.mailboxId ? `users/${session.mailboxId}` : "me";
    if (!match || decodeURIComponent(match[1]).toLowerCase() !== expected.toLowerCase()) {
      throw new Error("Invalid mailbox");
    }
    return { url: target.href, folder: decodeURIComponent(match[2]) };
  } catch {
    throw unprocessable("Invalid Microsoft mailbox sync cursor. Reconnect this mailbox.");
  }
}

function checkedDelta(url: string, session: MailboxSession, inboxId: string): string {
  const target = deltaTarget(url, session);
  if (target.folder.toLowerCase() !== "inbox" && target.folder !== inboxId) {
    throw unprocessable("Invalid Microsoft mailbox sync cursor. Reconnect this mailbox.");
  }
  return target.url;
}

@injectable()
export class MicrosoftClient {
  constructor(private readonly request: typeof fetch = fetch) {}

  authorizeUrl(config: OAuthClientConfig, state: string, verifier: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: microsoftScopes(config).join(" "),
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return `${authority(config)}/authorize?${params}`;
  }

  async exchangeCode(
    config: OAuthClientConfig,
    code: string,
    verifier: string,
  ): Promise<ExchangedCode> {
    const tokens = await this.token(config, {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: config.redirectUri,
    });
    if (!microsoftCanRead(tokens.scope, !!config.mailbox)) {
      throw new OAuthFlowError<EmailConnectErrorReason>("scope_not_granted");
    }
    const me = identitySchema.parse(
      await this.graph("/me?$select=mail,userPrincipalName", tokens.accessToken),
    );
    const signedInEmail = (me.mail ?? me.userPrincipalName).toLowerCase();
    const mailboxId = config.mailbox?.toLowerCase() ?? null;
    // Probe the selected inbox; delegated access must never fall back to the signed-in user's mail.
    await this.graph(`${mailboxPath(mailboxId)}/mailFolders/inbox?$select=id`, tokens.accessToken);
    return { tokens, email: mailboxId ?? signedInEmail, signedInEmail, mailboxId };
  }

  refresh(config: OAuthClientConfig, refreshToken: string): Promise<TokenSet> {
    return this.token(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: microsoftScopes(config).join(" "),
    });
  }

  private async token(
    config: OAuthClientConfig,
    fields: Record<string, string>,
  ): Promise<TokenSet> {
    const response = await this.safeRequest(`${authority(config)}/token`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...fields,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw badGateway("Microsoft authentication is temporarily unavailable. Try again later.");
      }
      throw unauthorized(
        "Microsoft rejected the mailbox authorization. Check the app settings and reconnect.",
      );
    }
    const tokens = tokenSchema.parse(await response.json());
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    };
  }

  private async safeRequest(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.request(url, init);
    } catch {
      throw badGateway("Microsoft mail could not be reached. Try again later.");
    }
  }

  private initialUrl(session: MailboxSession): string {
    const query = new URLSearchParams({
      $select: "id,conversationId,subject,from,body,bodyPreview,receivedDateTime",
      $filter: `receivedDateTime ge ${new Date(Date.now() - 14 * 86400000).toISOString()}`,
    });
    return `${GRAPH}${deltaPath(session)}?${query}`;
  }

  private async graph(path: string, token: string, init: RequestInit = {}): Promise<unknown> {
    const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await this.safeRequest(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'IdType="ImmutableId", odata.maxpagesize=50',
          ...init.headers,
        },
      });
      if (response.ok) {
        return response.status === 202 || response.status === 204 ? null : response.json();
      }
      if (
        init.method !== "POST" &&
        (response.status === 429 || response.status === 503) &&
        attempt < 2
      ) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? 2 ** attempt : Number(header);
        const delay = Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(header ?? "") - Date.now());
        if (Number.isFinite(delay) && delay <= 30000) {
          await Bun.sleep(delay);
          continue;
        }
      }
      if (response.status === 410) {
        throw new ExpiredCursor();
      }
      if (response.status === 401) {
        throw unauthorized("Microsoft mailbox authorization expired. Reconnect it.");
      }
      if (response.status === 403) {
        throw forbidden(
          "Microsoft denied access to the selected mailbox. Check delegated mailbox and Send As permissions.",
        );
      }
      if (response.status === 429 || response.status === 503) {
        throw tooManyRequests("Microsoft mail is rate limited. Wait before syncing again.", 60);
      }
      throw badGateway(
        "Microsoft mail request failed. Check the mailbox configuration and try again.",
      );
    }
    throw badGateway("Microsoft mail request failed.");
  }

  async sync(session: MailboxSession, since = Date.now() - 14 * 86400000): Promise<SyncResult> {
    if (!session.accessToken) {
      throw unauthorized("Reconnect the Microsoft mailbox.");
    }
    let initial = this.initialUrl(session);
    if (session.deltaLink) {
      initial = deltaTarget(session.deltaLink, session).url;
    }
    const inbox = z
      .object({ id: z.string().min(1) })
      .parse(
        await this.graph(
          `${mailboxPath(session.mailboxId)}/mailFolders/inbox?$select=id`,
          session.accessToken,
        ),
      );
    try {
      return await this.pages(initial, session, inbox.id, since);
    } catch (error) {
      if (!(error instanceof ExpiredCursor) || !session.deltaLink) {
        throw error;
      }
      return this.pages(this.initialUrl(session), session, inbox.id, since);
    }
  }

  private async pages(
    initial: string,
    session: MailboxSession,
    inboxId: string,
    since: number,
  ): Promise<SyncResult> {
    const messages = new Map<string, NormalizedMessage>();
    const visited = new Set<string>();
    let next: string | undefined = initial;
    for (let count = 0; next && count < 100; count++) {
      next = checkedDelta(next, session, inboxId);
      if (visited.has(next)) {
        throw badGateway("Microsoft returned a repeated mailbox page.");
      }
      visited.add(next);
      const page = pageSchema.parse(await this.graph(next, session.accessToken!));
      for (const raw of page.value) {
        if (typeof raw === "object" && raw !== null && "@removed" in raw) {
          continue;
        }
        const message = messageSchema.parse(raw);
        if (!message.from || Date.parse(message.receivedDateTime) < since) {
          continue;
        }
        const content = message.body ?? { contentType: "text", content: message.bodyPreview };
        const payload = {
          mimeType: content.contentType === "html" ? "text/html" : "text/plain",
          body: { data: encodeBase64Url(content.content) },
        };
        const address = message.from.emailAddress.address.toLowerCase();
        messages.set(message.id, {
          providerId: message.id,
          threadId: message.conversationId ?? null,
          subject: message.subject,
          fromAddress: address,
          fromName: message.from.emailAddress.name ?? null,
          fromDomain: emailDomain(address),
          snippet: message.bodyPreview,
          body: stripQuotedReplies(extractPlainText(payload)),
          links: extractLinks(payload),
          receivedAt: new Date(message.receivedDateTime),
        });
      }
      if (page["@odata.deltaLink"]) {
        return {
          fetched: messages.size,
          newMessages: [...messages.values()],
          deltaLink: checkedDelta(page["@odata.deltaLink"], session, inboxId),
        };
      }
      next = page["@odata.nextLink"];
    }
    throw badGateway(
      "Microsoft sync was incomplete. Its cursor has not advanced; try again later.",
    );
  }

  async send(session: MailboxSession, input: SendMessageInput): Promise<SentMessage> {
    if (
      !session.accessToken ||
      !session.config.allowSend ||
      !microsoftCanSend(session.scope, !!session.mailboxId)
    ) {
      throw unprocessable("This Microsoft mailbox is read-only. Reconnect with sending enabled.");
    }
    // MIME preserves RFC reply headers and attachments using the existing email builder.
    const from = session.mailboxId ? `From: ${z.email().parse(session.mailboxId)}\r\n` : "";
    const mime = Buffer.from(
      from +
        buildMimeMessage({
          to: input.to,
          subject: input.subject,
          body: input.body,
          inReplyTo: input.inReplyTo,
          attachments: input.attachments,
        }),
    ).toString("base64");
    await this.graph(`${mailboxPath(session.mailboxId)}/sendMail`, session.accessToken, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: mime,
    });
    return { providerId: "", threadId: input.threadId ?? "" };
  }
}

class ExpiredCursor extends Error {}
