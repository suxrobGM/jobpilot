import { injectable } from "@needle-di/core";
import { type gmail_v1, google } from "googleapis";
import { badGateway, unprocessable } from "@/common/errors";
import {
  buildMimeMessage,
  emailDomain,
  encodeBase64Url,
  extractLinks,
  extractPlainText,
  headerValue,
  parseAddress,
  stripQuotedReplies,
} from "./email.utils";
import type {
  ExchangedCode,
  MailboxSession,
  NormalizedMessage,
  OAuthClientConfig,
  SendMessageInput,
  SentMessage,
  TokenSet,
} from "./gmail.types";

// Derived from googleapis: importing google-auth-library directly can resolve a clashing version.
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
type Credentials = OAuth2Client["credentials"];
type Gmail = gmail_v1.Gmail;

interface GaxiosFailure {
  status?: number;
  response?: { data?: { error?: { errors?: { reason?: string }[] } } };
}

/** Scope that grants outbound send. Absent ⇒ the account must be reconnected. */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Scope that grants mailbox reads - the one scope a connection is useless without. */
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Scopes requested at consent; surfaced in the email settings UI. */
export const GMAIL_SCOPES = [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, "openid", "email"];

// Gmail allows about 50 message reads a second per user; more 429s and drops mail.
const PARALLEL_FETCHES = 10;

const SYNCED_MAIL_QUERY = "-in:chats -in:sent -category:promotions -category:social";

/**
 * Every user brings their own Google Cloud project, so "Gmail API not enabled" is that user's
 * setup mistake. Hand it back as an actionable 422 instead of a 500 carrying a Gaxios dump.
 */
export function rethrowGmailError(error: unknown): never {
  const failure = error as GaxiosFailure | null;
  const reasons = failure?.response?.data?.error?.errors?.map((e) => e.reason) ?? [];
  if (failure?.status === 403 && reasons.includes("accessNotConfigured")) {
    throw unprocessable(
      "Gmail API is not enabled in your Google Cloud project. Enable it in the API library, wait a minute, then sync again.",
    );
  }
  throw error;
}

function grants(scope: string | null | undefined, required: string): boolean {
  return !!scope && scope.split(/\s+/).includes(required);
}

/** Whether a stored, space-separated `scope` string grants send access. */
export function scopeCanSend(scope: string | null | undefined): boolean {
  return grants(scope, GMAIL_SEND_SCOPE);
}

/** Whether a stored, space-separated `scope` string grants mailbox reads. */
export function scopeCanRead(scope: string | null | undefined): boolean {
  return grants(scope, GMAIL_READ_SCOPE);
}

function oauthClient(config: OAuthClientConfig): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function gmailFor(session: MailboxSession): Gmail {
  const auth = oauthClient(session.config);
  auth.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.tokenExpiresAt?.getTime(),
  });
  return google.gmail({ version: "v1", auth });
}

function toTokenSet(credentials: Credentials, fallbackRefreshToken: string | null): TokenSet {
  if (!credentials.access_token) {
    throw badGateway("Google did not return an access token.");
  }
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? fallbackRefreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    scope: credentials.scope ?? null,
  };
}

/** `null` when the message can't be read (deleted since, transient failure). */
async function fetchMessage(gmail: Gmail, id: string): Promise<NormalizedMessage | null> {
  let message: gmail_v1.Schema$Message;
  try {
    message = (await gmail.users.messages.get({ userId: "me", id, format: "full" })).data;
  } catch {
    return null;
  }

  const headers = message.payload?.headers ?? [];
  const { email, name } = parseAddress(headerValue(headers, "From"));
  return {
    providerId: id,
    threadId: message.threadId ?? null,
    subject: headerValue(headers, "Subject"),
    fromAddress: email,
    fromName: name,
    fromDomain: emailDomain(email),
    snippet: message.snippet ?? "",
    body: stripQuotedReplies(extractPlainText(message.payload)),
    links: extractLinks(message.payload),
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)) : new Date(),
  };
}

@injectable()
export class GmailClient {
  /** The consent-screen URL; `state` is the CSRF token the caller keeps in a cookie. */
  authorizeUrl(config: OAuthClientConfig, state: string): string {
    return oauthClient(config).generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GMAIL_SCOPES,
      state,
    });
  }

  /** Trades the callback's `code` for tokens and resolves the mailbox address. */
  async exchangeCode(config: OAuthClientConfig, code: string): Promise<ExchangedCode> {
    const client = oauthClient(config);
    const { tokens } = await client.getToken(code);
    const tokenSet = toTokenSet(tokens, null);

    client.setCredentials(tokens);
    const me = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    if (!me.data.email) {
      throw badGateway("Google did not return the account's email address.");
    }
    return { email: me.data.email, tokens: tokenSet };
  }

  async refresh(config: OAuthClientConfig, refreshToken: string): Promise<TokenSet> {
    const client = oauthClient(config);
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    return toTokenSet(credentials, refreshToken);
  }

  /** Callers check `scopeCanSend` first; this assumes the grant includes send. */
  async send(session: MailboxSession, input: SendMessageInput): Promise<SentMessage> {
    const raw = encodeBase64Url(buildMimeMessage(input));
    const res = await gmailFor(session).users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: input.threadId },
    });
    return {
      providerId: res.data.id ?? "",
      threadId: res.data.threadId ?? input.threadId ?? "",
    };
  }

  /** Ids of mail received after `since`, every page. */
  async listMessageIds(session: MailboxSession, since: Date): Promise<string[]> {
    const gmail = gmailFor(session);
    const after = Math.floor(since.getTime() / 1000);
    const ids: string[] = [];
    let pageToken: string | null = null;
    try {
      do {
        // Annotated: pageToken is reassigned from the page, which TS cannot infer circularly.
        const page: gmail_v1.Schema$ListMessagesResponse = (
          await gmail.users.messages.list({
            userId: "me",
            q: `after:${after} ${SYNCED_MAIL_QUERY}`,
            maxResults: 500,
            pageToken: pageToken ?? undefined,
          })
        ).data;
        for (const message of page.messages ?? []) {
          if (message.id) {
            ids.push(message.id);
          }
        }
        pageToken = page.nextPageToken ?? null;
      } while (pageToken);
    } catch (error) {
      rethrowGmailError(error);
    }
    return ids;
  }

  async getMessages(session: MailboxSession, ids: string[]): Promise<NormalizedMessage[]> {
    const gmail = gmailFor(session);
    const messages: NormalizedMessage[] = [];
    for (let i = 0; i < ids.length; i += PARALLEL_FETCHES) {
      const batch = ids.slice(i, i + PARALLEL_FETCHES);
      const fetched = await Promise.all(batch.map((id) => fetchMessage(gmail, id)));
      messages.push(...fetched.filter((message) => message !== null));
    }
    return messages;
  }
}
