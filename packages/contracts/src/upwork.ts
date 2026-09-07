import { z } from "zod/v4";

export const UPWORK_PROPOSAL_STATUSES = ["draft", "submitted", "closed"] as const;
const upworkProposalStatusSchema = z.enum(UPWORK_PROPOSAL_STATUSES);
export type UpworkProposalStatus = z.infer<typeof upworkProposalStatusSchema>;

export const UPWORK_PROPOSAL_OUTCOMES = ["hired", "declined", "no_response"] as const;
const upworkProposalOutcomeSchema = z.enum(UPWORK_PROPOSAL_OUTCOMES);
export type UpworkProposalOutcome = z.infer<typeof upworkProposalOutcomeSchema>;

export const UPWORK_PROPOSAL_SOURCES = ["manual", "search"] as const;
const upworkProposalSourceSchema = z.enum(UPWORK_PROPOSAL_SOURCES);
export type UpworkProposalSource = z.infer<typeof upworkProposalSourceSchema>;

export const screeningAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const createUpworkProposalSchema = z.object({
  jobTitle: z.string().min(1),
  clientName: z.string().optional().nullable(),
  jobUrl: z.string().optional().nullable(),
  jobDescription: z.string().optional().nullable(),
  proposalText: z.string().optional(),
  screeningAnswers: z.array(screeningAnswerSchema).optional(),
  status: upworkProposalStatusSchema.optional(),
  notes: z.string().optional().nullable(),
  // Set when drafted from an Upwork search recommendation (links to the Job).
  source: upworkProposalSourceSchema.optional(),
  campaignId: z.string().optional().nullable(),
  jobKey: z.string().optional().nullable(),
});

export const patchUpworkProposalSchema = z.object({
  jobTitle: z.string().min(1).optional(),
  clientName: z.string().optional().nullable(),
  jobUrl: z.string().optional().nullable(),
  jobDescription: z.string().optional().nullable(),
  proposalText: z.string().optional(),
  screeningAnswers: z.array(screeningAnswerSchema).optional(),
  status: upworkProposalStatusSchema.optional(),
  outcome: upworkProposalOutcomeSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  submittedAt: z.iso.datetime().optional().nullable(),
});

export type ScreeningAnswer = z.infer<typeof screeningAnswerSchema>;
export type UpworkProposalInput = z.infer<typeof createUpworkProposalSchema>;
export type UpworkProposalPatch = z.infer<typeof patchUpworkProposalSchema>;

// Read off the Upwork MCP: the search row carries payment, spend, reviews and
// proposal count; clientHires comes from client_record on the per-job get.
// Every signal is nullable so a partial read degrades to a neutral score.
const upworkClientSchema = z.object({
  paymentVerified: z.boolean().nullish(),
  clientHires: z.number().int().min(0).nullish(), // lifetime hires, not a rate
  totalSpent: z.number().min(0).nullish(), // USD
  avgHourlyPaid: z.number().min(0).nullish(), // USD/hr
  rating: z.number().min(0).max(5).nullish(), // what freelancers scored this client
  reviewsCount: z.number().int().min(0).nullish(),
  proposalsCount: z.number().int().min(0).nullish(),
  postedHoursAgo: z.number().min(0).nullish(),
  country: z.string().nullish(),
  budget: z.number().min(0).nullish(), // fixed-price budget, USD
  jobType: z.enum(["fixed", "hourly"]).nullish(),
  memberSinceYear: z.number().int().nullish(),
});
export type UpworkClient = z.infer<typeof upworkClientSchema>;

export const upworkClientQualitySchema = z.object({ client: upworkClientSchema });

export interface UpworkQualityResult {
  qualityScore: number; // 0-100
  verdict: "good" | "caution" | "skip";
  flags: string[];
  skipReason: string | null; // set when verdict === "skip"
}

export const portfolioProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  url: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
});
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;

export const UPWORK_PROFILE_STATUSES = ["empty", "draft", "approved", "applied"] as const;
const upworkProfileStatusSchema = z.enum(UPWORK_PROFILE_STATUSES);
export type UpworkProfileStatus = z.infer<typeof upworkProfileStatusSchema>;

export const updateUpworkProfileSchema = z.object({
  currentTitle: z.string().optional().nullable(),
  currentOverview: z.string().optional().nullable(),
  currentHourlyRate: z.string().optional().nullable(),
  currentPortfolio: z.array(portfolioProjectSchema).optional(),
  currentSkills: z.array(z.string()).optional(),
  suggestedTitle: z.string().optional().nullable(),
  suggestedOverview: z.string().optional().nullable(),
  suggestedHourlyRate: z.string().optional().nullable(),
  suggestedPortfolio: z.array(portfolioProjectSchema).optional(),
  suggestedSkills: z.array(z.string()).optional(),
  status: upworkProfileStatusSchema.optional(),
});
export type UpdateUpworkProfileInput = z.infer<typeof updateUpworkProfileSchema>;

// The MCP runs in the user's local agent, so the browser cannot reach it. The
// sync skill mirrors what `get_freelancer_dashboard` returns into these rows and
// the web reads them from the API like any other JobPilot data.

export const updateUpworkAccountSchema = z.object({
  connectsBalance: z.number().int().min(0).optional().nullable(),
});
export type UpdateUpworkAccountInput = z.infer<typeof updateUpworkAccountSchema>;

export const UPWORK_INBOX_KINDS = ["invitation", "offer", "message"] as const;
const upworkInboxKindSchema = z.enum(UPWORK_INBOX_KINDS);
export type UpworkInboxKind = z.infer<typeof upworkInboxKindSchema>;

export const UPWORK_INBOX_STATUSES = ["unread", "read", "archived", "actioned"] as const;
const upworkInboxStatusSchema = z.enum(UPWORK_INBOX_STATUSES);
export type UpworkInboxStatus = z.infer<typeof upworkInboxStatusSchema>;

const upworkInboxItemInputSchema = z.object({
  upworkId: z.string().min(1),
  kind: upworkInboxKindSchema,
  title: z.string().min(1),
  clientName: z.string().optional().nullable(),
  jobUrl: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  receivedAt: z.iso.datetime(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

// One sync pushes a whole dashboard read, so the batch is the unit, not the row.
export const syncUpworkInboxSchema = z.object({
  items: z.array(upworkInboxItemInputSchema).max(200),
});
export type SyncUpworkInboxInput = z.infer<typeof syncUpworkInboxSchema>;

export const patchUpworkInboxItemSchema = z.object({
  status: upworkInboxStatusSchema,
});
export type PatchUpworkInboxItemInput = z.infer<typeof patchUpworkInboxItemSchema>;
