import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  type PipelineColumnData,
  type PipelineJob,
  type PipelineStage,
} from "./types";

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

const SAMPLES: PipelineJob[] = [
  {
    id: "j-acme-1",
    stage: "applying",
    role: "Senior Frontend Engineer",
    company: "Acme",
    location: "Remote",
    board: "linkedin",
    matchScore: 87,
    resumeVariant: "acme-v2",
    updatedAt: isoMinutesAgo(1),
    liveStep: "humanize",
    liveMessage:
      'Drafting answer 4 of 12 — the "why this role?" question — using your acme-v2 resume and the JD\'s emphasis on design systems.',
  },
  {
    id: "j-globex-1",
    stage: "queued",
    role: "Product Designer",
    company: "Globex",
    location: "NYC, hybrid",
    board: "wellfound",
    matchScore: 92,
    resumeVariant: "globex-v1",
    updatedAt: isoMinutesAgo(5),
  },
  {
    id: "j-linear-1",
    stage: "queued",
    role: "Frontend Lead, Growth",
    company: "Linear",
    location: "Remote",
    board: "linear.app",
    matchScore: 88,
    resumeVariant: "linear-v1",
    updatedAt: isoMinutesAgo(23),
  },
  {
    id: "j-notion-1",
    stage: "queued",
    role: "Senior Engineer, Billing",
    company: "Notion",
    location: "Remote",
    board: "greenhouse",
    matchScore: 79,
    resumeVariant: "base",
    updatedAt: isoMinutesAgo(48),
  },
  {
    id: "j-cf-1",
    stage: "discovered",
    role: "Principal Engineer, Infra",
    company: "Cloudflare",
    location: "Remote",
    board: "greenhouse",
    matchScore: 91,
    updatedAt: isoMinutesAgo(64),
  },
  {
    id: "j-vercel-1",
    stage: "discovered",
    role: "Senior Software Engineer",
    company: "Vercel",
    location: "Remote, US",
    board: "vercel",
    matchScore: 85,
    updatedAt: isoMinutesAgo(72),
  },
  {
    id: "j-recall-1",
    stage: "discovered",
    role: "Founding Engineer",
    company: "Recall AI",
    location: "NYC",
    board: "wellfound",
    matchScore: 78,
    updatedAt: isoMinutesAgo(120),
  },
  {
    id: "j-umbrella-1",
    stage: "submitted",
    role: "Engineering Manager",
    company: "Umbrella Corp",
    location: "Boston",
    board: "lever",
    matchScore: 74,
    resumeVariant: "eng-mgr",
    updatedAt: isoMinutesAgo(60 * 24),
  },
  {
    id: "j-stripe-1",
    stage: "submitted",
    role: "Senior Backend, Payments",
    company: "Stripe",
    location: "Remote",
    board: "greenhouse",
    matchScore: 69,
    resumeVariant: "base",
    updatedAt: isoMinutesAgo(60 * 24 * 2),
  },
  {
    id: "j-datadog-1",
    stage: "submitted",
    role: "Senior Software Engineer",
    company: "Datadog",
    location: "NYC",
    board: "greenhouse",
    matchScore: 72,
    resumeVariant: "base",
    updatedAt: isoMinutesAgo(60 * 24 * 3),
  },
  {
    id: "j-initech-1",
    stage: "replied",
    role: "Staff Engineer, Platform",
    company: "Initech",
    location: "SF",
    board: "greenhouse",
    matchScore: 81,
    resumeVariant: "base",
    updatedAt: isoMinutesAgo(120),
    replySummary: 'Sara Lin: "Loved your application — quick call this week?"',
  },
  {
    id: "j-acme-2",
    stage: "replied",
    role: "Senior Frontend Engineer",
    company: "Acme",
    location: "Remote",
    board: "linkedin",
    resumeVariant: "acme-v2",
    updatedAt: isoMinutesAgo(60 * 24),
    replySummary: "Auto-reply: under review",
  },
];

const COUNTS: Record<PipelineStage, number> = {
  discovered: 247,
  queued: 3,
  applying: 1,
  submitted: 47,
  replied: 2,
};

const TODAY: Record<PipelineStage, number> = {
  discovered: 18,
  queued: 2,
  applying: 1,
  submitted: 5,
  replied: 1,
};

export function getMockPipeline(): PipelineColumnData[] {
  return PIPELINE_STAGES.map((stage) => {
    const items = SAMPLES.filter((s) => s.stage === stage);
    return {
      stage,
      label: STAGE_LABEL[stage],
      total: COUNTS[stage],
      todayCount: TODAY[stage],
      items,
      hasMore: items.length < COUNTS[stage],
    };
  });
}
