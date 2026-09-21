import { z } from "zod/v4";
import { timeZoneSchema } from "./schedule";

/**
 * Senders whose mail is job-alert digests ("jobs you may like", saved-search alerts). Matched on the
 * sender's domain or any subdomain of it, so `jobalerts-noreply@linkedin.com` and
 * `alerts@e.theladders.com` both count.
 */
export const JOB_ALERT_SENDER_DOMAINS = [
  "linkedin.com",
  "theladders.com",
  "ladders.com",
  "weworkremotely.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "dice.com",
  "monster.com",
  "wellfound.com",
  "builtin.com",
  "hiring.cafe",
  "remoteok.com",
  "remotive.com",
  "himalayas.app",
  "workingnomads.com",
  "welcometothejungle.com",
  "otta.com",
  "simplyhired.com",
  "careerbuilder.com",
  "flexjobs.com",
  "jobright.ai",
] as const;

/**
 * Mailboxes on those domains that never carry postings - sign-in codes, invitations, chat digests,
 * application receipts. Matched on the address's local part.
 */
export const JOB_ALERT_EXCLUDED_MAILBOXES = [
  "login",
  "account",
  "security",
  "support",
  "invitations",
  "messaging-digest-noreply",
  "messages-noreply",
  "notifications-noreply",
  "editors-noreply",
  "hit-reply",
  "inmail-hit-reply",
  "indeedapply",
  "apply4me",
] as const;

const hourSchema = z.number().int().min(0).max(23);

/** When the pilot harvests job-alert emails into a campaign. Off until the user turns it on. */
export const pilotJobAlertsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Hours of the day, in `timeZone`. Deduped and sorted so every reader lists them in order. */
  runHours: z
    .array(hourSchema)
    .min(1, "Pick at least one time of day.")
    .max(12)
    .default([8, 17])
    .transform((hours) => [...new Set(hours)].sort((a, b) => a - b)),
  timeZone: timeZoneSchema.default("UTC"),
  /** Senders on top of the built-in list, as bare domains. */
  extraSenderDomains: z.array(z.string().trim().toLowerCase().min(1)).max(50).default([]),
});

export type PilotJobAlerts = z.infer<typeof pilotJobAlertsSchema>;

/** Built-in senders plus the user's own, deduped. */
export function jobAlertSenderDomains(config: PilotJobAlerts): string[] {
  return [...new Set([...JOB_ALERT_SENDER_DOMAINS, ...config.extraSenderDomains])];
}

/** Marks harvested alert emails so the next run skips them. */
export const markJobAlertsHarvestedSchema = z.object({
  messageIds: z.array(z.uuid()).min(1).max(200),
});

const JOB_ALERT_RUN_OUTCOMES = ["done", "failed", "abandoned", "expired"] as const;

/** The most recent harvest claim, and the campaign it opened when it opened one. */
const jobAlertsLastRunSchema = z.object({
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  // Null while the run is still in flight.
  outcome: z.enum(JOB_ALERT_RUN_OUTCOMES).nullable(),
  campaignId: z.uuid().nullable(),
  campaignQuery: z.string().nullable(),
});

/** Everything the schedule card renders, in one read. */
export const jobAlertsStatusSchema = z.object({
  settings: z.object({
    enabled: z.boolean(),
    runHours: z.array(z.number().int()),
    timeZone: z.string(),
    extraSenderDomains: z.array(z.string()),
  }),
  builtInSenderDomains: z.array(z.string()),
  pilotRunning: z.boolean(),
  mailboxConnected: z.boolean(),
  // Unharvested alert emails inside the lookback window - what a run would read right now.
  pendingEmails: z.number().int(),
  nextRunAt: z.date().nullable(),
  requestedAt: z.date().nullable(),
  lastRun: jobAlertsLastRunSchema.nullable(),
});

export const runJobAlertsResultSchema = z.object({
  // False when there was nothing to harvest, so no run was queued.
  queued: z.boolean(),
  pendingEmails: z.number().int(),
  pilotRunning: z.boolean(),
});

export type JobAlertsStatus = z.infer<typeof jobAlertsStatusSchema>;
export type RunJobAlertsResult = z.infer<typeof runJobAlertsResultSchema>;
