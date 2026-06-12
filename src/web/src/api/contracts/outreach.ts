import { z } from "zod/v4";
import { cleanReplacementChars } from "@/utils/text";

/** A free-text string with mangled replacement-char artifacts cleaned on write. */
const reasonText = z.string().transform(cleanReplacementChars);

// ── Campaign-level enums (stored in Campaign.config.outreach) ────────────────────

export const OUTREACH_CHANNELS = ["email", "linkedin"] as const;
export const outreachChannelSchema = z.enum(OUTREACH_CHANNELS);

export const LINKEDIN_TIERS = ["free", "premium"] as const;
export const linkedinTierSchema = z.enum(LINKEDIN_TIERS);

export const OUTREACH_AUTONOMY = ["draft", "review", "auto"] as const;
export const outreachAutonomySchema = z.enum(OUTREACH_AUTONOMY);

/** Shape of `Campaign.config.outreach` — the per-campaign mode selector. */
export const outreachConfigSchema = z.object({
  channels: z.array(outreachChannelSchema).min(1),
  linkedinTier: linkedinTierSchema.optional(),
  autonomy: outreachAutonomySchema.default("draft"),
  dailyCap: z.number().int().min(1).max(100).optional(),
  // Public, recipient-reachable resume link appended to the email body when present.
  resumeUrl: z.url().optional(),
});

// ── Message / contact enums ─────────────────────────────────────────────────

export const LINKEDIN_KINDS = ["inmail", "connect_note", "dm"] as const;
export const linkedinKindSchema = z.enum(LINKEDIN_KINDS);

export const OUTREACH_MESSAGE_STATUSES = [
  "draft",
  "approved",
  "sent",
  "replied",
  "bounced",
  "failed",
  "skipped",
] as const;
export const outreachMessageStatusSchema = z.enum(OUTREACH_MESSAGE_STATUSES);

/** Statuses past which a message is locked (no further editing or sending). */
export const OUTREACH_MESSAGE_TERMINAL_STATUSES: readonly string[] = [
  "sent",
  "replied",
  "bounced",
  "failed",
  "skipped",
];

export const CONTACT_LINKEDIN_CONNECTIONS = ["none", "pending", "connected"] as const;
export const contactLinkedinConnectionSchema = z.enum(CONTACT_LINKEDIN_CONNECTIONS);

export const CONTACT_EMAIL_SOURCES = ["guessed", "verified", "provided"] as const;
export const contactEmailSourceSchema = z.enum(CONTACT_EMAIL_SOURCES);

export const CONTACT_DISCOVERY_SOURCES = [
  "google",
  "company-site",
  "web",
  "linkedin",
  "manual",
] as const;
export const contactDiscoverySourceSchema = z.enum(CONTACT_DISCOVERY_SOURCES);

// ── Contact CRUD ────────────────────────────────────────────────────────────

export const contactFieldsSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  linkedinUrl: z.url().optional().nullable(),
  email: z.email().optional().nullable(),
  emailSource: contactEmailSourceSchema.optional().nullable(),
  emailConfidence: z.number().min(0).max(1).optional().nullable(),
  linkedinConnection: contactLinkedinConnectionSchema.optional(),
  discoverySource: contactDiscoverySourceSchema.optional().nullable(),
  matchConfidence: z.number().min(0).max(1).optional().nullable(),
  relatedAppId: z.number().int().optional().nullable(),
  relatedJobUrl: z.url().optional().nullable(),
  notes: reasonText.optional().nullable(),
});

export const createContactSchema = contactFieldsSchema;

// ── Outreach message ─────────────────────────────────────────────────────────

export const outreachMessageFieldsSchema = z.object({
  channel: outreachChannelSchema,
  linkedinKind: linkedinKindSchema.optional().nullable(),
  subject: reasonText.optional().nullable(),
  body: reasonText.default(""),
  status: outreachMessageStatusSchema.optional(),
});

/**
 * POST /api/campaigns/[id]/outreach — add a discovered contact (or attach to an
 * existing one via `contactId`) plus an initial draft message. Mirrors the
 * `addCampaignJobSchema` create-and-relate shape.
 */
export const addCampaignOutreachSchema = z
  .object({
    contactId: z.number().int().optional(),
    contact: createContactSchema.optional(),
    message: outreachMessageFieldsSchema,
  })
  .refine((v) => v.contactId != null || v.contact != null, {
    message: "Provide either contactId or contact.",
  });

/** PATCH /api/campaigns/[id]/outreach/[messageId] — non-terminal edits. */
export const patchOutreachMessageSchema = z.object({
  status: outreachMessageStatusSchema.optional(),
  subject: reasonText.optional().nullable(),
  body: reasonText.optional(),
  failReason: reasonText.optional().nullable(),
  providerId: z.string().optional().nullable(),
  threadId: z.string().optional().nullable(),
  /** Convenience: when set, also updates the parent contact's connection state. */
  contactLinkedinConnection: contactLinkedinConnectionSchema.optional(),
});

export const OUTREACH_MESSAGE_OUTCOMES = ["sent", "failed", "skipped"] as const;
export const outreachMessageOutcomeSchema = z.enum(OUTREACH_MESSAGE_OUTCOMES);

/** POST /api/campaigns/[id]/outreach/[messageId]/result — terminal outcome. */
export const outreachMessageResultSchema = z
  .object({
    outcome: outreachMessageOutcomeSchema,
    sentAt: z.iso.datetime().optional(),
    providerId: z.string().optional(),
    threadId: z.string().optional(),
    failReason: z.string().min(1).transform(cleanReplacementChars).optional(),
  })
  .refine((v) => v.outcome !== "failed" || !!v.failReason, {
    message: "failed requires failReason.",
  });

// ── Email send (POST /api/email/send) ────────────────────────────────────────

export const sendEmailSchema = z.object({
  to: z.email(),
  subject: reasonText.default(""),
  body: reasonText.default(""),
  threadId: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        contentBase64: z.string().min(1),
      }),
    )
    .optional(),
});

export type OutreachConfig = z.infer<typeof outreachConfigSchema>;
export type OutreachChannel = z.infer<typeof outreachChannelSchema>;
export type LinkedinTier = z.infer<typeof linkedinTierSchema>;
export type OutreachAutonomy = z.infer<typeof outreachAutonomySchema>;
export type OutreachMessageStatus = z.infer<typeof outreachMessageStatusSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type AddCampaignOutreachInput = z.infer<typeof addCampaignOutreachSchema>;
export type PatchOutreachMessageInput = z.infer<typeof patchOutreachMessageSchema>;
export type OutreachMessageOutcome = z.infer<typeof outreachMessageOutcomeSchema>;
export type OutreachMessageResultInput = z.infer<typeof outreachMessageResultSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;
