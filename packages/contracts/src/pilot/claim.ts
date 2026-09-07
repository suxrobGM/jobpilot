import { z } from "zod/v4";
import { agendaClaimFieldsSchema } from "./agenda";

export const PILOT_CLAIM_OUTCOMES = ["done", "failed", "abandoned", "expired"] as const;

/** The subset an agent may report on release; "expired" is only ever set server-side. */
const releasableOutcomeSchema = z.enum(["done", "failed", "abandoned"]);

export const createPilotClaimSchema = z.object({
  agendaVersion: z.uuid(),
  itemId: z.string().min(1),
});

export const releasePilotClaimSchema = z.object({
  outcome: releasableOutcomeSchema,
  note: z.string().optional(),
});

const pilotClaimBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  grantedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  releasedAt: z.date().nullable(),
  outcome: z.enum(PILOT_CLAIM_OUTCOMES).nullable(),
});

export const pilotClaimSchema = z.intersection(pilotClaimBaseSchema, agendaClaimFieldsSchema);

export type ReleasePilotClaimInput = z.infer<typeof releasePilotClaimSchema>;
export type PilotClaim = z.infer<typeof pilotClaimSchema>;
