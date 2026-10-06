import { google } from "googleapis";
import { unprocessable } from "@/common/errors";
import { logger } from "@/common/logger";
import type { EmailAccount, EmailProvider } from "@/generated/prisma/client";
import type {
  MailboxProvider,
  NormalizedMessage,
  OAuthClientConfig,
  SendMessageInput,
  SentMessage,
  SyncResult,
  TokenSet,
} from "./email.provider";
import {
  buildMimeMessage,
  domainOf,
  type EmailHeader,
  encodeBase64Url,
  extractPlainText,
  headerValue,
  parseAddress,
  stripQuotedReplies,
} from "./email.utils";

/**
 * Derived from `google.auth.OAuth2` so the type always matches the bundled
 * `google-auth-library` that `googleapis` ships - importing the type from the
 * top-level `google-auth-library` can resolve to a different version and clash.
 */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/** Scope that grants outbound send. Absent ⇒ the account must be reconnected. */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Scope that grants mailbox reads - the one scope a connection is useless without. */
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Scopes requested at consent; surfaced in the email settings UI. */
export const GMAIL_SCOPES = [GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, "openid", "email"];

/**
 * Every user brings their own Google Cloud project, so "Gmail API not enabled" is that user's
 * setup mistake. Hand it back as an actionable 422 instead of a 500 carrying a Gaxios dump.
 */
export function rethrowGmailError(error: unknown): never {
  const failure = error as {
    status?: number;
    response?: { data?: { error?: { errors?: { reason?: string }[] } } };
  };
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

export interface HistoryPage {
  messageIds: string[];
  historyId: string | null;
  nextPageToken: string | null;
}

/**
 * Every message added since the cursor, across all pages. Each page reports the mailbox's *current*
 * `historyId`, so saving it after reading only the first page (100 records) skips the rest for good -
 * which is what a sync after a few days offline used to do.
 */
export async function readAddedMessageIds(
  fetchPage: (pageToken?: string) => Promise<HistoryPage>,
): Promise<{ messageIds: string[]; historyId: string | null }> {
  const messageIds = new Set<string>();
  let historyId: string | null = null;
  let pageToken: string | undefined;
  do {
    const page = await fetchPage(pageToken);
    for (const id of page.messageIds) messageIds.add(id);
    historyId = page.historyId ?? historyId;
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);
  return { messageIds: [...messageIds], historyId };
}

/** A per-user rate or quota refusal: every later fetch in this run would be refused too. */
export function isQuotaError(err: unknown): boolean {
  const { status, code, message } = (err ?? {}) as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  if (status === 429 || code === 429 || code === "429") return true;
  return /quota exceeded|rate ?limit/i.test(message ?? "");
}

/** Gmail answers 404 for a message deleted between the history read and the fetch. */
function isGoneError(err: unknown): boolean {
  const { status, code } = (err ?? {}) as { status?: number; code?: number | string };
  return status === 404 || code === 404 || code === "404";
}

/**
 * The cursor to save after a sync. A fetch that failed for any reason but deletion holds the old
 * cursor: advancing past it drops that message for good, and the next sync's refetch of the rest
 * costs only duplicate inserts, which the sync skips.
 */
export function nextHistoryCursor(
  previous: string | null,
  fetched: string | null,
  failedFetches: number,
): string | null {
  return failedFetches > 0 ? previous : fetched;
}

class GmailProvider implements MailboxProvider {
  private makeOAuthClient(config: OAuthClientConfig): OAuth2Client {
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }

  private clientForAccount(config: OAuthClientConfig, account: EmailAccount): OAuth2Client {
    const client = this.makeOAuthClient(config);
    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiresAt?.getTime(),
    });
    return client;
  }

  getAuthorizeUrl(config: OAuthClientConfig, state: string): string {
    return this.makeOAuthClient(config).generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GMAIL_SCOPES,
      state,
    });
  }

  async exchangeCode(
    config: OAuthClientConfig,
    code: string,
  ): Promise<{ tokens: TokenSet; email: string }> {
    const client = this.makeOAuthClient(config);
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token");
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email;

    if (!email) {
      throw new Error("Could not resolve Google account email");
    }

    return {
      email,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
      },
    };
  }

  async refresh(config: OAuthClientConfig, refreshToken: string): Promise<TokenSet> {
    const client = this.makeOAuthClient(config);
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to refresh Google access token");
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      scope: credentials.scope ?? null,
    };
  }

  async sendMessage(
    config: OAuthClientConfig,
    account: EmailAccount,
    input: SendMessageInput,
  ): Promise<SentMessage> {
    const auth = this.clientForAccount(config, account);
    const gmail = google.gmail({ version: "v1", auth });

    const raw = encodeBase64Url(
      buildMimeMessage({
        to: input.to,
        subject: input.subject,
        body: input.body,
        inReplyTo: input.inReplyTo,
        attachments: input.attachments,
      }),
    );

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: input.threadId },
    });

    return {
      providerId: res.data.id ?? "",
      threadId: res.data.threadId ?? input.threadId ?? "",
    };
  }

  async syncMessages(
    config: OAuthClientConfig,
    account: EmailAccount,
    knownIds: (ids: string[]) => Promise<Set<string>>,
  ): Promise<SyncResult> {
    const auth = this.clientForAccount(config, account);
    const gmail = google.gmail({ version: "v1", auth });

    const messageIds: string[] = [];
    let newHistoryId: string | null = null;

    if (account.historyId) {
      try {
        const startHistoryId = account.historyId;
        const added = await readAddedMessageIds(async (pageToken) => {
          const res = await gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            pageToken,
          });
          return {
            messageIds: (res.data.history ?? []).flatMap((h) =>
              (h.messagesAdded ?? []).flatMap((ma) => (ma.message?.id ? [ma.message.id] : [])),
            ),
            historyId: res.data.historyId ?? null,
            nextPageToken: res.data.nextPageToken ?? null,
          };
        });

        newHistoryId = added.historyId ?? account.historyId;
        messageIds.push(...added.messageIds);
      } catch {
        // history cursor too old - fall back to list
      }
    }

    if (!account.historyId || newHistoryId === null) {
      const res = await gmail.users.messages.list({
        userId: "me",
        maxResults: 50,
        q: "newer_than:14d -in:chats -category:promotions -category:social",
      });

      for (const m of res.data.messages ?? []) {
        if (m.id) {
          messageIds.push(m.id);
        }
      }

      const profile = await gmail.users.getProfile({ userId: "me" });
      newHistoryId = profile.data.historyId ?? null;
    }

    // A held cursor replays the same range; refetching stored mail would spend the quota the
    // retry needs and never get past the message that stopped the last run.
    const known = await knownIds(messageIds);
    const toFetch = messageIds.filter((id) => !known.has(id));

    const newMessages: NormalizedMessage[] = [];
    let failedFetches = 0;
    for (const [index, id] of toFetch.entries()) {
      try {
        const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const headers = (msg.data.payload?.headers ?? []) as EmailHeader[];
        const fromHeader = headerValue(headers, "From");
        const { email, name } = parseAddress(fromHeader);
        const internal = msg.data.internalDate
          ? new Date(Number(msg.data.internalDate))
          : new Date();

        const plain = stripQuotedReplies(extractPlainText(msg.data.payload));

        newMessages.push({
          providerId: msg.data.id ?? id,
          threadId: msg.data.threadId ?? null,
          subject: headerValue(headers, "Subject"),
          fromAddress: email,
          fromName: name,
          fromDomain: domainOf(email),
          snippet: msg.data.snippet ?? "",
          rawBody: plain,
          receivedAt: internal,
        });
      } catch (err) {
        if (isQuotaError(err)) {
          failedFetches += toFetch.length - index;
          logger.warn(
            { remaining: toFetch.length - index },
            "Gmail quota exhausted; holding the sync cursor until the next sync",
          );
          break;
        }
        if (!isGoneError(err)) {
          failedFetches += 1;
          logger.warn(
            { err, messageId: id },
            "Gmail message fetch failed; holding the sync cursor",
          );
        }
      }
    }

    return {
      fetched: messageIds.length,
      newMessages,
      historyId: nextHistoryCursor(account.historyId, newHistoryId, failedFetches),
    };
  }
}

const gmailProvider = new GmailProvider();

export function getProvider(name: EmailProvider): MailboxProvider {
  if (name === "gmail") {
    return gmailProvider;
  }
  throw new Error(`Unsupported email provider: ${name}`);
}

/** Whether the account's stored scope permits sending (currently Gmail-only). */
export function accountCanSend(account: { provider: string; scope: string | null }): boolean {
  if (account.provider === "gmail") {
    return scopeCanSend(account.scope);
  }
  return false;
}
