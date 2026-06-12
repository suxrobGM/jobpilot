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

// ── Client-quality scoring (smart filter) ───────────────────────────────────
// Scraped from an Upwork posting + client panel. Every signal is nullable so a
// partially-readable card degrades to a neutral score rather than crashing.
export const PROPOSAL_BUCKETS = ["<5", "5-10", "10-15", "15-20", "20-50", "50+"] as const;
const proposalsBucketSchema = z.enum(PROPOSAL_BUCKETS);
export type ProposalsBucket = z.infer<typeof proposalsBucketSchema>;

export const upworkClientSchema = z.object({
  paymentVerified: z.boolean().nullish(),
  hireRate: z.number().min(0).max(100).nullish(), // %
  totalSpent: z.number().min(0).nullish(), // USD
  avgHourlyPaid: z.number().min(0).nullish(), // USD/hr
  rating: z.number().min(0).max(5).nullish(),
  reviewsCount: z.number().int().min(0).nullish(),
  proposalsBucket: proposalsBucketSchema.nullish(),
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

// ── Profile enhancement ──────────────────────────────────────────────────────
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
  suggestedTitle: z.string().optional().nullable(),
  suggestedOverview: z.string().optional().nullable(),
  suggestedHourlyRate: z.string().optional().nullable(),
  suggestedPortfolio: z.array(portfolioProjectSchema).optional(),
  status: upworkProfileStatusSchema.optional(),
});
export type UpdateUpworkProfileInput = z.infer<typeof updateUpworkProfileSchema>;
