import { Prisma } from "@/generated/prisma/client";

/**
 * Clears the cached agenda. Every write that changes an agenda input must carry it, or the agent
 * keeps working from a stale snapshot until its TTL lapses.
 */
export const AGENDA_SNAPSHOT_RESET = {
  agendaVersion: null,
  agendaGeneratedAt: null,
  agendaExpiresAt: null,
  agendaSnapshot: Prisma.DbNull,
} as const;
