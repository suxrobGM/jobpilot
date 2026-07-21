import { z } from "zod/v4";
import { agendaClaimFieldsSchema } from "./agenda";

/** Release outcomes an agent reports; claims also close as "expired" server-side. */
export const PILOT_CLAIM_OUTCOMES = ["done", "failed", "abandoned"] as const;
export const pilotClaimOutcomeSchema = z.enum(PILOT_CLAIM_OUTCOMES);

export const createPilotClaimSchema = z.object({
  agendaVersion: z.uuid(),
  itemId: z.string().min(1),
});

export const releasePilotClaimSchema = z.object({
  outcome: pilotClaimOutcomeSchema,
  note: z.string().optional(),
});

const pilotClaimBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  grantedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  releasedAt: z.date().nullable(),
  outcome: z.enum([...PILOT_CLAIM_OUTCOMES, "expired"]).nullable(),
});

export const pilotClaimSchema = z.intersection(pilotClaimBaseSchema, agendaClaimFieldsSchema);

export type ReleasePilotClaimInput = z.infer<typeof releasePilotClaimSchema>;
export type PilotClaim = z.infer<typeof pilotClaimSchema>;
