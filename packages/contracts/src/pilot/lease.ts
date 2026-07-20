import { z } from "zod/v4";
import { agendaLeaseFieldsSchema } from "./agenda";

/** Release outcomes an agent reports; leases also close as "expired" server-side. */
export const PILOT_LEASE_OUTCOMES = ["done", "failed", "abandoned"] as const;
export const pilotLeaseOutcomeSchema = z.enum(PILOT_LEASE_OUTCOMES);

export const createPilotLeaseSchema = z.object({
  agendaVersion: z.uuid(),
  itemId: z.string().min(1),
});

export const releasePilotLeaseSchema = z.object({
  outcome: pilotLeaseOutcomeSchema,
  note: z.string().optional(),
});

const pilotLeaseBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  grantedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  releasedAt: z.date().nullable(),
  outcome: z.enum([...PILOT_LEASE_OUTCOMES, "expired"]).nullable(),
});

export const pilotLeaseSchema = z.intersection(pilotLeaseBaseSchema, agendaLeaseFieldsSchema);

export type ReleasePilotLeaseInput = z.infer<typeof releasePilotLeaseSchema>;
export type PilotLease = z.infer<typeof pilotLeaseSchema>;
