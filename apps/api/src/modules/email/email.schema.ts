import { statusSchema } from "@jobpilot/contracts/application";
import { classificationSchema, reviewStatusSchema } from "@jobpilot/contracts/email";
import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

/** What narrows a set of inbox messages, whether the caller wants the rows or just how many. */
export const messageFilters = z.object({
  reviewStatus: z.string().optional(),
  classification: z.string().optional(),
  since: z.string().optional(),
  domainHint: z.string().optional(),
  verificationDomain: z.string().optional(),
});

export const messagesQuery = paginationQuerySchema.extend(messageFilters.shape);

export const messageCountSchema = z.object({ count: z.number().int().min(0) });

export const startQuery = z.object({ provider: z.string().optional() });

export const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

/** Connection status of the profile's linked mailbox (`account.accountStatus`). */
export const accountStatusSchema = z.union([
  z.object({
    connected: z.literal(false),
    canSend: z.boolean(),
  }),
  z.object({
    connected: z.literal(true),
    provider: z.string(),
    email: z.string(),
    lastSyncAt: z.date().nullable(),
    canSend: z.boolean(),
    // True once a token refresh was rejected (invalid_grant): the mailbox must be reconnected.
    needsReauth: z.boolean(),
  }),
]);

/** Confirmation returned by disconnecting the mailbox (`account.disconnectAccount`). */
export const accountDisconnectedSchema = z.object({ disconnected: z.boolean() });

/** OAuth client config status (`account.getOAuthClient`) - never includes the secret. */
export const oauthClientStatusSchema = z.object({
  configured: z.boolean(),
  provider: z.string(),
  clientId: z.string().nullable(),
  redirectUri: z.string(),
  scopes: z.array(z.string()),
});

/** Confirmation returned by removing the OAuth client (`account.deleteOAuthClient`). */
export const oauthClientDeletedSchema = z.object({ deleted: z.boolean() });

/** Matched-application summary embedded on a message (`matchedApp` relation). */
export const matchedAppSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    company: z.string(),
    status: statusSchema,
  })
  .nullable();

/** A serialized inbox message (`serializeMessage` - Date fields are ISO strings). */
export const emailMessageSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  providerId: z.string(),
  threadId: z.string().nullable(),
  subject: z.string(),
  fromAddress: z.string(),
  fromName: z.string().nullable(),
  fromDomain: z.string(),
  snippet: z.string(),
  rawBody: z.string(),
  receivedAt: z.date(),
  fetchedAt: z.date(),
  scannedAt: z.date().nullable(),
  classification: classificationSchema.nullable(),
  confidence: z.number().nullable(),
  reasoning: z.string().nullable(),
  matchedAppId: z.uuid().nullable(),
  matchScore: z.number().nullable(),
  reviewStatus: reviewStatusSchema,
  // Free String column; writes are validated against the status enum, reads stay lenient.
  appliedStatus: z.string().nullable(),
  verificationCode: z.string().nullable(),
  verificationLink: z.string().nullable(),
  verificationDomain: z.string().nullable(),
  matchedApp: matchedAppSchema,
});

/** List of serialized inbox messages (`svc.listMessages`). */
export const emailMessageListSchema = paginatedSchema(emailMessageSchema);

/** Result of denying a message (`svc.denyMessage`). */
export const messageDeniedSchema = z.object({
  id: z.uuid(),
  status: z.literal("denied"),
});

/** Result of approving a message and advancing its application (`svc.approveMessage`). */
export const messageApprovedSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  status: statusSchema,
});

/** Provider message + thread ids returned after sending (`account.send`). */
export const sentMessageSchema = z.object({
  providerId: z.string(),
  threadId: z.string(),
});

/** Fetched and newly-inserted counts from a sync run (`sync.syncInbox`). */
export const syncResultSchema = z.object({
  fetched: z.number().int(),
  new: z.number().int(),
});
