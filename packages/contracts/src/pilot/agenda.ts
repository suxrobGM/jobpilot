import { z } from "zod/v4";
import { networkingModeSchema } from "../networking";

// The server picks the channel and resolves the mode, so "off" never reaches a worker - an off
// channel means the item is not emitted at all.
const outgoingMode = networkingModeSchema.shape;

const AGENDA_ITEM_KINDS = [
  "question.answered",
  "job.apply",
  "search.discover",
  "campaign.scorePending",
  "campaign.reviewPaused",
  "inbox.review",
  "networking.send",
  "networking.followup",
  "networking.warmIntro",
  "promo.compose",
  "promo.post",
  "interview.reply",
  "interview.prep",
  "queue.drain",
  "board.health",
  "campaign.strategyReview",
  "job.rescanSkipped",
  "job.retryFailed",
  "strategy.bootstrap",
] as const;

const AGENDA_SUBJECT_TYPES = [
  "job",
  "campaign",
  "question",
  "networking",
  "inbox",
  "promotion",
  "application",
  "email",
  "board",
  "pilot",
] as const;

const nullableString = z.string().nullable();
const optionalString = z.string().optional();
const warmContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: nullableString,
  email: nullableString,
});

const agendaItem = <K extends (typeof AGENDA_ITEM_KINDS)[number], P extends z.ZodType>(
  kind: K,
  subjectType: (typeof AGENDA_SUBJECT_TYPES)[number],
  payload: P,
) =>
  z.object({
    kind: z.literal(kind),
    subjectType: z.literal(subjectType),
    subjectId: z.string(),
    payload,
  });

export const agendaClaimFieldsSchema = z.discriminatedUnion("kind", [
  agendaItem(
    "question.answered",
    "question",
    z.object({
      questionId: z.string(),
      questionKind: z.string(),
      subjectType: nullableString,
      subjectId: nullableString,
      prompt: z.string(),
      answer: nullableString,
    }),
  ),
  agendaItem(
    "job.apply",
    "job",
    z.object({
      campaignId: z.string(),
      jobKey: z.string(),
      url: z.string(),
      board: nullableString,
      digest: nullableString,
      resumeId: optionalString,
      matchScore: z.number().nullable(),
      warmContacts: z.array(warmContactSchema).optional(),
    }),
  ),
  agendaItem(
    "search.discover",
    "campaign",
    z.object({
      searchId: z.string(),
      query: z.string(),
      board: optionalString,
      resumeId: optionalString,
      minScore: z.number(),
      // Existing in-progress campaign for this query; the agent reuses it instead of creating one.
      campaignId: optionalString,
      // Fresh non-duplicate rows this run aims for, and the page cap for the paginated crawl.
      newJobsTarget: z.number().int(),
      maxPages: z.number().int(),
    }),
  ),
  agendaItem(
    "campaign.scorePending",
    "campaign",
    z.object({
      campaignId: z.string(),
      query: z.string(),
      board: nullableString,
      resumeId: optionalString,
      minScore: z.number(),
      pendingCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string(), title: z.string() })),
    }),
  ),
  agendaItem(
    "campaign.reviewPaused",
    "campaign",
    z.object({
      campaignId: z.string(),
      query: z.string(),
      board: nullableString,
      // The campaign's last status-transition time - approximates when it was paused.
      pausedAt: z.date(),
    }),
  ),
  agendaItem(
    "inbox.review",
    "inbox",
    z.object({ messageIds: z.array(z.string()), count: z.number().int() }),
  ),
  agendaItem(
    "networking.send",
    "networking",
    z.object({
      campaignId: z.string(),
      messageId: z.string(),
      contactId: z.string(),
      contactName: z.string(),
      contactEmail: z.string(),
      subject: nullableString,
      body: z.string(),
    }),
  ),
  agendaItem(
    "networking.followup",
    "networking",
    z.object({
      campaignId: z.string(),
      messageId: z.string(),
      contactId: z.string(),
      contactName: z.string(),
      contactEmail: z.string(),
      subject: nullableString,
      sentAt: z.date(),
      daysSince: z.number().int(),
      ...outgoingMode,
    }),
  ),
  agendaItem(
    "networking.warmIntro",
    "networking",
    z.object({
      campaignId: z.string(),
      jobKey: z.string(),
      company: nullableString,
      jobTitle: z.string(),
      jobUrl: z.string(),
      // Empty when nobody at the company is known yet; the worker discovers one.
      contacts: z.array(warmContactSchema).default([]),
      ...outgoingMode,
    }),
  ),
  agendaItem(
    "promo.compose",
    "promotion",
    z.object({ platform: z.string(), target: optionalString }),
  ),
  agendaItem(
    "promo.post",
    "promotion",
    z.object({
      promotionId: z.string(),
      platform: z.string(),
      target: nullableString,
      title: nullableString,
      body: z.string(),
    }),
  ),
  agendaItem(
    "interview.reply",
    "email",
    z.object({
      applicationId: z.string(),
      emailMessageId: z.string(),
      threadId: nullableString,
      from: z.string(),
      subject: z.string(),
      receivedAt: z.date(),
      company: z.string(),
      jobTitle: z.string(),
    }),
  ),
  agendaItem(
    "interview.prep",
    "application",
    z.object({
      applicationId: z.string(),
      company: z.string(),
      jobTitle: z.string(),
      jobUrl: nullableString,
      resumeId: nullableString,
    }),
  ),
  agendaItem(
    "queue.drain",
    "campaign",
    z.object({
      campaignId: z.string(),
      resumeId: optionalString,
      minScore: z.number(),
      queuedCount: z.number().int(),
      entries: z.array(z.object({ key: z.string(), url: z.string() })),
    }),
  ),
  agendaItem(
    "board.health",
    "board",
    z.object({
      board: z.string(),
      consecutiveFailures: z.number().int(),
      recentFailReasons: z.array(z.string()),
      probeJob: z
        .object({ campaignId: z.string(), jobKey: z.string(), url: z.string() })
        .nullable(),
    }),
  ),
  agendaItem(
    "campaign.strategyReview",
    "campaign",
    z.object({
      campaignId: z.string(),
      query: z.string(),
      config: z.object({ minScore: z.number().nullable(), board: nullableString }),
      counts: z.object({
        totalFound: z.number().int(),
        qualified: z.number().int(),
        applied: z.number().int(),
        skipped: z.number().int(),
      }),
      topSkipReasons: z.array(z.string()),
    }),
  ),
  agendaItem(
    "job.rescanSkipped",
    "campaign",
    z.object({ campaignId: z.string(), skippedCount: z.number().int() }),
  ),
  agendaItem(
    "job.retryFailed",
    "campaign",
    z.object({ campaignId: z.string(), failedCount: z.number().int() }),
  ),
  agendaItem(
    "strategy.bootstrap",
    "pilot",
    z.object({
      goals: z.string(),
      minScore: z.number(),
    }),
  ),
]);

export const agendaItemSchema = z.intersection(
  z.object({ id: z.string(), priority: z.number(), title: z.string() }),
  agendaClaimFieldsSchema,
);

export const agendaContentSchema = z.object({
  generatedAt: z.date(),
  items: z.array(agendaItemSchema),
  counts: z.object({
    openQuestions: z.number().int(),
    activeClaims: z.number().int(),
    approvedJobs: z.number().int(),
    appliedToday: z.number().int(),
  }),
  budget: z.object({
    dailyApplyCap: z.number().int(),
    appliedToday: z.number().int(),
    capReached: z.boolean(),
    dailyNetworkingCap: z.number().int(),
    networkingSentToday: z.number().int(),
    resetsAt: z.date(),
  }),
  emptyReason: z.enum(["capReached", "awaitingSetup", "clear"]).nullable(),
  sleepSeconds: z.number(),
  nextWakeAt: z.date(),
});

export const agendaResponseSchema = agendaContentSchema.extend({
  version: z.uuid(),
  expiresAt: z.date(),
});

export const currentAgendaResponseSchema = z.object({ agenda: agendaResponseSchema.nullable() });

export type AgendaItem = z.infer<typeof agendaItemSchema>;
export type AgendaContent = z.infer<typeof agendaContentSchema>;
export type AgendaResponse = z.infer<typeof agendaResponseSchema>;
