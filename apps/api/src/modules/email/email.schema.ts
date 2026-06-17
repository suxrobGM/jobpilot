import { classificationSchema, reviewStatusSchema } from "@jobpilot/contracts/email";
import { z } from "zod/v4";

export const messagesQuery = z.object({
  reviewStatus: z.string().optional(),
  classification: z.string().optional(),
  since: z.string().optional(),
  domainHint: z.string().optional(),
  verificationDomain: z.string().optional(),
});

export const startQuery = z.object({ provider: z.string().optional() });

export const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

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
  }),
]);

/** Confirmation returned by disconnecting the mailbox (`account.disconnectAccount`). */
export const accountDisconnectedSchema = z.object({ disconnected: z.boolean() });

/** Matched-application summary embedded on a message (`matchedApp` relation). */
export const matchedAppSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    company: z.string(),
    stage: z.string(),
  })
  .nullable();

/** A serialized inbox message (`serializeMessage` — Date fields are ISO strings). */
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
  appliedStage: z.string().nullable(),
  verificationCode: z.string().nullable(),
  verificationLink: z.string().nullable(),
  verificationDomain: z.string().nullable(),
  matchedApp: matchedAppSchema,
});

/** List of serialized inbox messages (`svc.listMessages`). */
export const emailMessageListSchema = z.array(emailMessageSchema);

/** Result of denying a message (`svc.denyMessage`). */
export const messageDeniedSchema = z.object({
  id: z.uuid(),
  status: z.literal("denied"),
});

/** Result of approving a message and advancing its application (`svc.approveMessage`). */
export const messageApprovedSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  stage: z.string(),
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
