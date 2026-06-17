import { z } from "zod/v4";
import { PIPELINE_STAGES } from "./pipeline.constants";

const filter = z.string().trim().min(1).nullish().catch(null);

export const pipelineQuery = z.object({
  stage: z.enum(PIPELINE_STAGES),
  cursor: z.string().min(1).nullish().catch(null),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .catch(50)
    .transform((n) => Math.min(n, 200)),
  search: filter,
  board: filter,
  campaignId: filter,
});

// ── Response schemas ──────────────────────────────────────────────────────────

/** One Kanban card in a pipeline column (mirrors `PipelineJobDto`). */
export const pipelineJobSchema = z.object({
  id: z.string(),
  stage: z.enum(PIPELINE_STAGES),
  role: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  board: z.string().nullable(),
  matchScore: z.number().nullable(),
  resumeVariant: z.string().nullable(),
  updatedAt: z.date(),
  liveStep: z.string().nullable(),
  liveMessage: z.string().nullable(),
  stageSummary: z.string().nullable(),
  url: z.string(),
  campaignId: z.string().nullable(),
  applicationId: z.string().nullable(),
});

/** One paginated Kanban stage column (mirrors `PipelineColumnPage`). */
export const pipelineColumnPageSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  items: z.array(pipelineJobSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
  todayCount: z.number().int(),
});
