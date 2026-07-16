import { z } from "zod/v4";

// ── Leases ────────────────────────────────────────────────────────────────────

/** Release outcomes an agent reports; leases also close as "expired" server-side. */
const PILOT_LEASE_OUTCOMES = ["done", "failed", "abandoned"] as const;
const pilotLeaseOutcomeSchema = z.enum(PILOT_LEASE_OUTCOMES);

export const createPilotLeaseSchema = z.object({ itemId: z.string().min(1) });

export const releasePilotLeaseSchema = z.object({
  outcome: pilotLeaseOutcomeSchema,
  note: z.string().optional(),
});

export const pilotLeaseSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  kind: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  grantedAt: z.date(),
  heartbeatAt: z.date().nullable(),
  expiresAt: z.date(),
  releasedAt: z.date().nullable(),
  outcome: z.string().nullable(),
});

export type ReleasePilotLeaseInput = z.infer<typeof releasePilotLeaseSchema>;
export type PilotLease = z.infer<typeof pilotLeaseSchema>;
