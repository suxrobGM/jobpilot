import { z } from "zod/v4";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ESCALATION_KINDS = ["question", "choice", "2fa", "approval"] as const;
export const escalationKindSchema = z.enum(ESCALATION_KINDS);

export const ESCALATION_STATUSES = ["open", "answered", "expired", "cancelled"] as const;
export const escalationStatusSchema = z.enum(ESCALATION_STATUSES);

export const PILOT_JOURNAL_KINDS = [
  "cycle",
  "action",
  "observation",
  "escalation",
  "system",
  "digest",
  // A user override (declined/edited a draft) captured as a labeled learning signal.
  "correction",
] as const;
export const pilotJournalKindSchema = z.enum(PILOT_JOURNAL_KINDS);

export const AGENDA_ITEM_KINDS = [
  "escalation.answered",
  "job.apply",
  "search.discover",
  "campaign.finalize",
  "inbox.triage",
  "outreach.send",
  "outreach.followup",
  "outreach.warmIntro",
  "promo.compose",
  "promo.post",
  "interview.reply",
  "interview.prep",
  // M4 proactive work + board health.
  "queue.drain",
  "board.health",
  "campaign.strategyReview",
  "job.rescanSkipped",
  "job.retryFailed",
] as const;
export const agendaItemKindSchema = z.enum(AGENDA_ITEM_KINDS);

export const AGENDA_SUBJECT_TYPES = [
  "job",
  "campaign",
  "escalation",
  "outreach",
  "inbox",
  "promotion",
  "application",
  "email",
  "queue",
  "board",
] as const;
export const agendaSubjectTypeSchema = z.enum(AGENDA_SUBJECT_TYPES);

/** Release outcomes an agent reports; leases also close as "expired" server-side. */
export const PILOT_LEASE_OUTCOMES = ["done", "failed", "abandoned"] as const;
export const pilotLeaseOutcomeSchema = z.enum(PILOT_LEASE_OUTCOMES);

// ── Mandate ───────────────────────────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const pilotActiveHoursSchema = z.object({
  start: z.string().regex(HHMM),
  end: z.string().regex(HHMM),
  tz: z.string(),
});

export const pilotStandingQuerySchema = z.object({
  query: z.string().min(1),
  board: z.string().optional(),
  // Base resume the discovered campaign scores against; campaign config requires it.
  resumeId: z.string().optional(),
  cadenceHours: z.number().default(24),
});

export const pilotAutonomySchema = z.object({
  outreachEmail: z.enum(["draft", "review", "auto"]).default("review"),
  outreachLinkedIn: z.enum(["draft", "review"]).default("draft"),
});

export const pilotPromotionVenueSchema = z.object({
  venue: z.string().min(1),
  target: z.string().optional(),
  cadenceDays: z.number().int().min(1).default(30),
});

/** Self-promotion config. Review-only in M3: auto-posting is deliberately not offered. */
export const pilotPromotionConfigSchema = z.object({
  venues: z.array(pilotPromotionVenueSchema).default([]),
  autonomy: z.literal("review").default("review"),
});

/**
 * The Pilot's operating envelope, stored as JSON in `PilotState.mandateConfig`.
 * Every field defaults, so an empty `{}` parses to a full, usable config.
 */
export const pilotMandateConfigSchema = z.object({
  dailyApplyCap: z.number().int().min(0).default(10),
  minScore: z.number().min(0).max(100).default(70),
  boards: z.array(z.string()).default([]),
  activeHours: pilotActiveHoursSchema.optional(),
  checkIntervalMinutes: z.number().int().default(30),
  standingQueries: z.array(pilotStandingQuerySchema).default([]),
  // Full default so a missing key still yields both autonomy fields (zod does not re-parse defaults).
  autonomy: pilotAutonomySchema.default({ outreachEmail: "review", outreachLinkedIn: "draft" }),
  dailyOutreachCap: z.number().int().min(0).default(5),
  outreachFollowupDays: z.number().int().default(5),
  // Full default so a missing key still yields a usable promotion block (zod does not re-parse defaults).
  promotion: pilotPromotionConfigSchema.default({ venues: [], autonomy: "review" }),
  // Boards the user agreed to park; agenda excludes their job.apply items and standing queries.
  parkedBoards: z.array(z.string()).default([]),
});

export const updatePilotMandateSchema = z.object({
  goals: z.string(),
  config: pilotMandateConfigSchema,
});

export const setPilotEnabledSchema = z.object({ enabled: z.boolean() });

export const pilotStateSchema = z.object({
  profileId: z.uuid(),
  enabled: z.boolean(),
  mandateGoals: z.string(),
  mandateConfig: pilotMandateConfigSchema,
  mandateUpdatedAt: z.date().nullable(),
  lastCycleAt: z.date().nullable(),
  cycleCount: z.number().int(),
  // Today's applied count (tz-aware) and whether it has reached the mandate's daily cap.
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ── Agenda ────────────────────────────────────────────────────────────────────

export const agendaItemSchema = z.object({
  id: z.string(),
  kind: agendaItemKindSchema,
  priority: z.number(),
  title: z.string(),
  subjectType: agendaSubjectTypeSchema,
  subjectId: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const agendaCountsSchema = z.object({
  openEscalations: z.number().int(),
  activeLeases: z.number().int(),
  approvedJobs: z.number().int(),
  appliedToday: z.number().int(),
});

export const agendaBudgetSchema = z.object({
  dailyApplyCap: z.number().int(),
  appliedToday: z.number().int(),
  capReached: z.boolean(),
  resetsAt: z.date(),
});

export const agendaResponseSchema = z.object({
  generatedAt: z.date(),
  items: z.array(agendaItemSchema),
  counts: agendaCountsSchema,
  budget: agendaBudgetSchema,
  sleepSeconds: z.number(),
  nextWakeAt: z.date(),
});

// ── Leases ────────────────────────────────────────────────────────────────────

export const createPilotLeaseSchema = z.object({ itemId: z.string().min(1) });

export const releasePilotLeaseSchema = z.object({
  outcome: pilotLeaseOutcomeSchema,
  note: z.string().optional(),
});

export const pilotLeaseSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  kind: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  grantedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  releasedAt: z.date().nullable(),
  outcome: z.string().nullable(),
});

// ── Journal ───────────────────────────────────────────────────────────────────

export const pilotJournalEntryInputSchema = z.object({
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
});

export const createPilotJournalSchema = z.object({
  cycleId: z.string().optional(),
  entries: z.array(pilotJournalEntryInputSchema).min(1),
});

export const pilotJournalEntrySchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  cycleId: z.string().nullable(),
  kind: pilotJournalKindSchema,
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()),
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  createdAt: z.date(),
});

export const pilotJournalQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const pilotJournalPageSchema = z.object({
  items: z.array(pilotJournalEntrySchema),
  nextCursor: z.string().nullable(),
});

// ── Escalations ───────────────────────────────────────────────────────────────

export const createEscalationSchema = z.object({
  kind: escalationKindSchema,
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  question: z.string().min(1),
  options: z.array(z.string()).default([]),
  deepLink: z.string().optional(),
  expiresAt: z.iso.datetime().optional(),
});

export const answerEscalationSchema = z.object({ answer: z.string().min(1) });

export const escalationsQuerySchema = z.object({ status: escalationStatusSchema.optional() });

export const escalationSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  kind: escalationKindSchema,
  status: escalationStatusSchema,
  subjectType: z.string().nullable(),
  subjectId: z.string().nullable(),
  question: z.string(),
  options: z.array(z.string()),
  deepLink: z.string().nullable(),
  answer: z.string().nullable(),
  answeredAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const escalationListSchema = z.array(escalationSchema);

// ── Web push ──────────────────────────────────────────────────────────────────

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().optional(),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().min(1) });

export const vapidKeySchema = z.object({ publicKey: z.string().nullable() });

/** Returned on subscribe; the browser needs only the id/endpoint back. */
export const pushSubscriptionSchema = z.object({
  id: z.uuid(),
  endpoint: z.string(),
  createdAt: z.date(),
});

/** Device row for the manage-devices list. */
export const pushSubscriptionListItemSchema = z.object({
  id: z.uuid(),
  endpoint: z.string(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});

export const pushSubscriptionListSchema = z.array(pushSubscriptionListItemSchema);

// ── Promotion posts ─────────────────────────────────────────────────────────────

export const PROMOTION_STATUSES = [
  "draft",
  "approved",
  "declined",
  "posted",
  "failed",
  "skipped",
  "expired",
] as const;
export const promotionStatusSchema = z.enum(PROMOTION_STATUSES);

/** Statuses past which a post is locked (no further editing or approval). */
export const PROMOTION_TERMINAL_STATUSES: readonly string[] = [
  "declined",
  "posted",
  "failed",
  "skipped",
  "expired",
];

/** Agent creates a draft post for a venue. */
export const createPromotionSchema = z.object({
  venue: z.string().min(1),
  target: z.string().optional(),
  title: z.string().optional(),
  body: z.string().min(1),
});

/** User edits the draft body/title, or moves draft → approved | declined, or schedules it. */
export const patchPromotionSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(["approved", "declined"]).optional(),
  scheduledFor: z.iso.datetime().optional(),
});

export const PROMOTION_OUTCOMES = ["posted", "failed", "skipped"] as const;
export const promotionOutcomeSchema = z.enum(PROMOTION_OUTCOMES);

/** Agent reports the terminal outcome after posting. */
export const promotionResultSchema = z.object({
  outcome: promotionOutcomeSchema,
  postedUrl: z.string().optional(),
  note: z.string().optional(),
});

export const promotionsQuerySchema = z.object({ status: promotionStatusSchema.optional() });

export const promotionSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  venue: z.string(),
  target: z.string().nullable(),
  title: z.string().nullable(),
  body: z.string(),
  status: promotionStatusSchema,
  postedUrl: z.string().nullable(),
  scheduledFor: z.date().nullable(),
  postedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const promotionListSchema = z.array(promotionSchema);

// ── Types ─────────────────────────────────────────────────────────────────────

export type EscalationKind = z.infer<typeof escalationKindSchema>;
export type EscalationStatus = z.infer<typeof escalationStatusSchema>;
export type PilotJournalKind = z.infer<typeof pilotJournalKindSchema>;
export type AgendaItemKind = z.infer<typeof agendaItemKindSchema>;
export type AgendaSubjectType = z.infer<typeof agendaSubjectTypeSchema>;
export type PilotLeaseOutcome = z.infer<typeof pilotLeaseOutcomeSchema>;
export type PilotMandateConfig = z.infer<typeof pilotMandateConfigSchema>;
export type PilotStandingQuery = z.infer<typeof pilotStandingQuerySchema>;
export type UpdatePilotMandateInput = z.infer<typeof updatePilotMandateSchema>;
export type SetPilotEnabledInput = z.infer<typeof setPilotEnabledSchema>;
export type PilotState = z.infer<typeof pilotStateSchema>;
export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type AgendaResponse = z.infer<typeof agendaResponseSchema>;
export type CreatePilotLeaseInput = z.infer<typeof createPilotLeaseSchema>;
export type ReleasePilotLeaseInput = z.infer<typeof releasePilotLeaseSchema>;
export type PilotLease = z.infer<typeof pilotLeaseSchema>;
export type PilotJournalEntryInput = z.infer<typeof pilotJournalEntryInputSchema>;
export type CreatePilotJournalInput = z.infer<typeof createPilotJournalSchema>;
export type PilotJournalEntry = z.infer<typeof pilotJournalEntrySchema>;
export type CreateEscalationInput = z.infer<typeof createEscalationSchema>;
export type AnswerEscalationInput = z.infer<typeof answerEscalationSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type PushSubscriptionDto = z.infer<typeof pushSubscriptionSchema>;
export type PushSubscriptionListItem = z.infer<typeof pushSubscriptionListItemSchema>;
export type PilotPromotionVenue = z.infer<typeof pilotPromotionVenueSchema>;
export type PilotPromotionConfig = z.infer<typeof pilotPromotionConfigSchema>;
export type PromotionStatus = z.infer<typeof promotionStatusSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type PatchPromotionInput = z.infer<typeof patchPromotionSchema>;
export type PromotionOutcome = z.infer<typeof promotionOutcomeSchema>;
export type PromotionResultInput = z.infer<typeof promotionResultSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
