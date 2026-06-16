import { z } from "zod/v4";
import { PIPELINE_STAGES } from "./pipeline.constants";

const filter = z.string().trim().min(1).nullish().catch(null);

export const pipelineQuery = z.object({
  stage: z.enum(PIPELINE_STAGES),
  cursor: z.coerce.number().int().positive().nullish().catch(null),
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
