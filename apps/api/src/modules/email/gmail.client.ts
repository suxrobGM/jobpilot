import { injectable } from "@needle-di/core";
import { google } from "googleapis";
import { badGateway, unprocessable } from "@/common/errors";
import {
  buildMimeMessage,
  domainOf,
  type EmailHeader,
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
  SyncResult,
  TokenSet,
} from "./gmail.types";

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

function oauthClient(config: OAuthClientConfig): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function gmailFor(session: MailboxSession) {
  const auth = oauthClient(session.config);
  auth.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.tokenExpiresAt?.getTime(),
  });
  return google.gmail({ version: "v1", auth });
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
    if (!tokens.access_token) {
      throw badGateway("Google did not return an access token.");
    }

    client.setCredentials(tokens);
    const me = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    const email = me.data.email;
    if (!email) {
      throw badGateway("Google did not return the account's email address.");
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
    const client = oauthClient(config);
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw badGateway("Google did not return a refreshed access token.");
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      scope: credentials.scope ?? null,
    };
  }

  /** Callers check `scopeCanSend` first; this assumes the grant includes send. */
  async send(session: MailboxSession, input: SendMessageInput): Promise<SentMessage> {
    const raw = encodeBase64Url(
      buildMimeMessage({
        to: input.to,
        subject: input.subject,
        body: input.body,
        inReplyTo: input.inReplyTo,
        attachments: input.attachments,
      }),
    );

    const res = await gmailFor(session).users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: input.threadId },
    });

    return {
      providerId: res.data.id ?? "",
      threadId: res.data.threadId ?? input.threadId ?? "",
    };
  }

  /**
   * Delta sync from `historyId` when the cursor is still valid, otherwise a recent-mail list.
   * Returns the new cursor for the caller to persist.
   */
  async sync(session: MailboxSession): Promise<SyncResult> {
    try {
      return await this.fetchNewMessages(session);
    } catch (error) {
      rethrowGmailError(error);
    }
  }

  private async fetchNewMessages(session: MailboxSession): Promise<SyncResult> {
    const gmail = gmailFor(session);
    const messageIds: string[] = [];
    let newHistoryId: string | null = null;

    if (session.historyId) {
      try {
        const res = await gmail.users.history.list({
          userId: "me",
          startHistoryId: session.historyId,
          historyTypes: ["messageAdded"],
        });

        newHistoryId = res.data.historyId ?? session.historyId;

        for (const h of res.data.history ?? []) {
          for (const ma of h.messagesAdded ?? []) {
            if (ma.message?.id) messageIds.push(ma.message.id);
          }
        }
      } catch {
        // history cursor too old - fall back to list
      }
    }

    if (!session.historyId || newHistoryId === null) {
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

    const newMessages: NormalizedMessage[] = [];
    for (const id of messageIds) {
      try {
        const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const headers = (msg.data.payload?.headers ?? []) as EmailHeader[];
        const { email, name } = parseAddress(headerValue(headers, "From"));
        const receivedAt = msg.data.internalDate
          ? new Date(Number(msg.data.internalDate))
          : new Date();

        newMessages.push({
          providerId: msg.data.id ?? id,
          threadId: msg.data.threadId ?? null,
          subject: headerValue(headers, "Subject"),
          fromAddress: email,
          fromName: name,
          fromDomain: domainOf(email),
          snippet: msg.data.snippet ?? "",
          rawBody: stripQuotedReplies(extractPlainText(msg.data.payload)),
          links: extractLinks(msg.data.payload),
          receivedAt,
        });
      } catch {
        // skip individual failures
      }
    }

    return { fetched: messageIds.length, newMessages, historyId: newHistoryId };
  }
}
