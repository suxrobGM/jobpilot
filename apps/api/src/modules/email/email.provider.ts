import type { EmailAccount } from "@/generated/prisma/client";

/** The OAuth client (app) a provider authenticates as — resolved per-user from the user's own EmailOAuthClient. */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * OAuth tokens returned by a provider after consent or refresh.
 *
 * `refreshToken` is only present on the *first* consent (Google issues it
 * once per `prompt=consent` flow). Persist it; subsequent refreshes return
 * a new `accessToken` but may omit `refreshToken`.
 */
export interface TokenSet {
  /** Short-lived bearer token used to call the provider's API. */
  accessToken: string;
  /** Long-lived token used to obtain new access tokens. */
  refreshToken?: string | null;
  /** Absolute expiry of `accessToken`. `null` when the provider didn't say. */
  expiresAt?: Date | null;
  /** Space-separated list of OAuth scopes the token actually grants. */
  scope?: string | null;
}

/**
 * Provider-neutral shape that JobPilot stores in the `EmailMessage` table.
 * Each `EmailProvider.syncMessages()` implementation is responsible for
 * decoding its raw message format into this shape.
 */
export interface NormalizedMessage {
  /** The provider's own immutable message id (e.g. Gmail message id). */
  providerId: string;
  /** Provider thread id, when threads are a concept. `null` otherwise. */
  threadId: string | null;
  subject: string;
  /** Sender email, lowercased. */
  fromAddress: string;
  /** Sender display name (e.g. "Jane @ Acme"), or `null` if absent. */
  fromName: string | null;
  /** Lowercased domain portion of `fromAddress` — used for matching. */
  fromDomain: string;
  /** Short single-line preview supplied by the provider. */
  snippet: string;
  /** Plain-text message body with quoted replies stripped. */
  rawBody: string;
  /** When the message arrived in the user's mailbox. */
  receivedAt: Date;
}

/** A file attached to an outbound message. `contentBase64` is standard base64. */
export interface OutboundAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * An outbound message to send. `threadId` keeps a reply in the same thread;
 * `inReplyTo` is the RFC822 Message-Id being answered. `attachments` is only
 * populated on the warm reply/second touch — never on a cold first touch.
 */
export interface SendMessageInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  attachments?: OutboundAttachment[];
}

/** Identifiers of a message the provider accepted for delivery. */
export interface SentMessage {
  providerId: string;
  threadId: string;
}

/**
 * Result of one `syncMessages` call. `newMessages` are messages the caller
 * has not yet seen; `historyId` is a provider-specific cursor the caller
 * should persist for the next delta sync.
 */
export interface SyncResult {
  /** Total messages inspected (new + already-known). */
  fetched: number;
  /** Messages not yet present in the local database. */
  newMessages: NormalizedMessage[];
  /** Cursor to pass back on the next sync, or `null` for full re-list. */
  historyId: string | null;
}

/**
 * Pluggable email-provider contract.
 *
 * Implementations isolate provider-specific OAuth and message-fetching
 * details so the rest of the app can stay provider-neutral. Today only
 * `GmailProvider` exists; IMAP and Outlook providers can slot in here
 * without changes to routes or schema.
 */
export interface EmailProvider {
  /**
   * Build the consent-screen URL the user is redirected to. `state` is an
   * opaque CSRF token the caller stores in a cookie and verifies on
   * callback.
   */
  getAuthorizeUrl(config: OAuthClientConfig, state: string): string;

  /**
   * Exchange the OAuth `code` returned to the callback for tokens and
   * resolve the user's email address. Called once per Connect flow.
   */
  exchangeCode(
    config: OAuthClientConfig,
    code: string,
  ): Promise<{ tokens: TokenSet; email: string }>;

  /**
   * Use a stored refresh token to obtain a fresh access token. Called by
   * the sync route when `tokenExpiresAt` has passed.
   */
  refresh(config: OAuthClientConfig, refreshToken: string): Promise<TokenSet>;

  /**
   * Send an outbound message from the connected mailbox. Returns the
   * provider's message + thread ids so callers can track replies. Callers
   * must gate on `accountCanSend` first — this assumes send scope is present.
   */
  sendMessage(
    config: OAuthClientConfig,
    account: EmailAccount,
    input: SendMessageInput,
  ): Promise<SentMessage>;

  /**
   * Pull new messages from the mailbox. Implementations should:
   * - prefer a delta query using `account.historyId` when present,
   * - fall back to a recent-mail list on first sync or when the cursor is
   *   too old,
   * - return a fresh `historyId` so the caller can persist it.
   */
  syncMessages(config: OAuthClientConfig, account: EmailAccount): Promise<SyncResult>;
}
