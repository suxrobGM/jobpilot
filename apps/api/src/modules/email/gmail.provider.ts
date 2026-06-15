import { google } from "googleapis";
import { env } from "@/env";
import type { EmailAccount } from "@/generated/prisma/client";
import type {
  EmailProvider,
  NormalizedMessage,
  SendMessageInput,
  SentMessage,
  SyncResult,
  TokenSet,
} from "./email.provider";
import {
  buildMimeMessage,
  domainOf,
  encodeBase64Url,
  extractPlainText,
  headerValue,
  parseAddress,
  stripQuotedReplies,
  type EmailHeader,
} from "./email.utils";

/**
 * Derived from `google.auth.OAuth2` so the type always matches the bundled
 * `google-auth-library` that `googleapis` ships — importing the type from the
 * top-level `google-auth-library` can resolve to a different version and clash.
 */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/** Scope that grants outbound send. Absent ⇒ the account must be reconnected. */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  GMAIL_SEND_SCOPE,
  "openid",
  "email",
];

/** Whether a stored, space-separated `scope` string grants send access. */
export function scopeCanSend(scope: string | null | undefined): boolean {
  return !!scope && scope.split(/\s+/).includes(GMAIL_SEND_SCOPE);
}

interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getEnv(): GoogleEnv {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured. See README.md.");
  }
  return { clientId, clientSecret, redirectUri };
}

export class GmailProvider implements EmailProvider {
  private makeOAuthClient(): OAuth2Client {
    const { clientId, clientSecret, redirectUri } = getEnv();
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private clientForAccount(account: EmailAccount): OAuth2Client {
    const client = this.makeOAuthClient();
    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiresAt?.getTime(),
    });
    return client;
  }

  getAuthorizeUrl(state: string): string {
    return this.makeOAuthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GMAIL_SCOPES,
      state,
    });
  }

  async exchangeCode(code: string): Promise<{ tokens: TokenSet; email: string }> {
    const client = this.makeOAuthClient();
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

  async refresh(refreshToken: string): Promise<TokenSet> {
    const client = this.makeOAuthClient();
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

  async sendMessage(account: EmailAccount, input: SendMessageInput): Promise<SentMessage> {
    if (!scopeCanSend(account.scope)) {
      throw new Error("Connected Gmail account lacks send access. Reconnect it to enable sending.");
    }

    const auth = this.clientForAccount(account);
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

  async syncMessages(account: EmailAccount): Promise<SyncResult> {
    const auth = this.clientForAccount(account);
    const gmail = google.gmail({ version: "v1", auth });

    const messageIds: string[] = [];
    let newHistoryId: string | null = null;

    if (account.historyId) {
      try {
        const res = await gmail.users.history.list({
          userId: "me",
          startHistoryId: account.historyId,
          historyTypes: ["messageAdded"],
        });

        newHistoryId = res.data.historyId ?? account.historyId;

        for (const h of res.data.history ?? []) {
          for (const ma of h.messagesAdded ?? []) {
            if (ma.message?.id) messageIds.push(ma.message.id);
          }
        }
      } catch {
        // history cursor too old — fall back to list
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

    const newMessages: NormalizedMessage[] = [];
    for (const id of messageIds) {
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
      } catch {
        // skip individual failures
      }
    }

    return {
      fetched: messageIds.length,
      newMessages,
      historyId: newHistoryId,
    };
  }
}

export const gmailProvider = new GmailProvider();

export function getProvider(name: string): EmailProvider {
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
