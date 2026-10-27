import type { EmailLink } from "./email.schema";

/** The user's own Google OAuth client (app); the redirect URI is the shared, env-configured one. */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Tokens Google returns after consent or refresh. `refreshToken` arrives only on the first
 * consent (`prompt=consent`); later refreshes may omit it, so persist the first one.
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  /** `null` when Google didn't say. */
  expiresAt?: Date | null;
  /** Space-separated scopes the token actually grants. */
  scope?: string | null;
}

export interface ExchangedCode {
  tokens: TokenSet;
  email: string;
}

/**
 * A connected mailbox ready to call Gmail with: tokens already decrypted and refreshed. A distinct
 * type from the `EmailAccount` row, whose token columns hold ciphertext.
 */
export interface MailboxSession {
  config: OAuthClientConfig;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  /** Gmail's delta-sync cursor; `null` before the first sync. */
  historyId: string | null;
}

/** An inbound message in the shape the `EmailMessage` table stores. */
export interface NormalizedMessage {
  /** Gmail's immutable message id. */
  providerId: string;
  threadId: string | null;
  subject: string;
  /** Lowercased. */
  fromAddress: string;
  fromName: string | null;
  /** Lowercased domain of `fromAddress`, used for matching. */
  fromDomain: string;
  snippet: string;
  /** Plain-text body with quoted replies stripped. */
  rawBody: string;
  links: EmailLink[];
  receivedAt: Date;
}

/** `contentBase64` is standard base64. */
interface OutboundAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * `threadId` keeps a reply in its thread; `inReplyTo` is the RFC822 Message-Id being answered.
 * Attachments ride only the warm reply or second touch, never a cold first touch.
 */
export interface SendMessageInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  attachments?: OutboundAttachment[];
}

export interface SentMessage {
  providerId: string;
  threadId: string;
}

export interface SyncResult {
  /** Messages inspected, new and already known. */
  fetched: number;
  newMessages: NormalizedMessage[];
  /** Cursor for the next delta sync; `null` forces a full re-list. */
  historyId: string | null;
}
