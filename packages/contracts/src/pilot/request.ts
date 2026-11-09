import { z } from "zod/v4";

export const PILOT_REQUEST_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;
export const PILOT_REQUEST_SOURCES = ["web", "chat", "notice"] as const;

const request = <K extends string, P extends z.ZodObject>(taskType: K, payload: P) =>
  z.object({ taskType: z.literal(taskType), payload });

/** Work the user asks for by name; it runs as a normal pilot run, autopilot or not. */
export const createPilotRequestSchema = z.discriminatedUnion("taskType", [
  request("job.apply", z.object({ feedId: z.uuid(), jobKey: z.string().min(1) })),
  request(
    "job.rescanSkipped",
    z.object({
      feedId: z.uuid(),
      jobKeys: z.array(z.string().min(1)).max(200).optional(),
      minScore: z.number().int().min(0).max(100).optional(),
    }),
  ),
  request("job.retryFailed", z.object({ feedId: z.uuid() })),
  request("inbox.review", z.object({ messageIds: z.array(z.string().min(1)).max(100).optional() })),
  request("upwork.syncInbox", z.object({})),
  request("search.discover", z.object({ searchId: z.uuid() })),
  request("inbox.jobAlerts", z.object({})),
  request("search.setup", z.object({})),
  // `focus` narrows one requested search, in the user's words ("university labs in PA").
  request("research.explore", z.object({ focus: z.string().trim().min(1).max(500).optional() })),
  request("resume.extract", z.object({ resumeId: z.uuid(), force: z.boolean().default(false) })),
  request(
    "resume.tailor",
    z.object({ jobDescription: z.string().trim().min(1), baseResumeId: z.uuid().optional() }),
  ),
  request("networking.find", z.object({ criteria: z.string().trim().min(1).max(1000) })),
  request("networking.rewrite", z.object({ messageIds: z.array(z.uuid()).min(1).max(100) })),
  request("upwork.profile", z.object({ mode: z.enum(["review", "apply"]) })),
  request("upwork.proposal", z.object({ proposalId: z.uuid() })),
  request("upwork.submit", z.object({ proposalId: z.uuid() })),
]);

export type CreatePilotRequestInput = z.infer<typeof createPilotRequestSchema>;

/** Request bodies arrive from the web and from chat; `source` says which. */
export const createPilotRequestBodySchema = z.intersection(
  createPilotRequestSchema,
  z.object({ source: z.enum(PILOT_REQUEST_SOURCES).default("web") }),
);

export const pilotRequestSchema = z.object({
  id: z.uuid(),
  taskType: z.string(),
  title: z.string(),
  status: z.enum(PILOT_REQUEST_STATUSES),
  source: z.enum(PILOT_REQUEST_SOURCES),
  runId: z.uuid().nullable(),
  createdAt: z.date(),
  finishedAt: z.date().nullable(),
});

export type PilotRequest = z.infer<typeof pilotRequestSchema>;
