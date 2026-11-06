import { z } from "zod/v4";

/** One readable line of what a run is doing: a label only, never typed values or page text. */
const pilotStepSchema = z.object({
  /** Counts up within the run. */
  id: z.number().int(),
  at: z.date(),
  label: z.string(),
});

export type PilotStep = z.infer<typeof pilotStepSchema>;

export const pilotStepListSchema = z.array(pilotStepSchema);

export const postPilotStepsSchema = z.object({
  steps: z
    .array(
      z.object({ at: z.iso.datetime({ offset: true }), label: z.string().trim().min(1).max(200) }),
    )
    .min(1)
    .max(100),
});
