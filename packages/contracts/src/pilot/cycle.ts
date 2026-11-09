import { z } from "zod/v4";

/**
 * One host loop pass, with or without a run; the host sleeps this long before the next. `message`
 * is something the user must act on (a broken provider sign-in), posted to them as the pilot.
 */
export const recordCycleSchema = z.object({
  sleepSeconds: z.number().int().min(0),
  message: z.string().trim().min(1).optional(),
});
export type RecordCycleInput = z.infer<typeof recordCycleSchema>;

/** Reported in host health only. */
const pilotCycleStatusSchema = z.enum(["ok", "empty", "error"]);
export type PilotCycleStatus = z.infer<typeof pilotCycleStatusSchema>;
