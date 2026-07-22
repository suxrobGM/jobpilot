"use client";

import type { PilotJournalKind } from "@jobpilot/contracts/pilot";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { formatTimeUntil, humanizeIsoInText } from "@/utils/format";
import { isHostOffline } from "../host-status";
import { useJournalLive } from "../journal/use-journal-live";
import { usePilotStatus } from "./pilot-status-context";
import { useNextWake } from "./use-next-wake";

export type PilotStageNode = "orchestrator" | "agent" | "worker" | "results";
type PilotStageMode = "off" | "offline" | "working" | "sleeping";

/** Which diagram node the newest journal entry lights up. */
const NODE_BY_KIND: Record<PilotJournalKind, PilotStageNode> = {
  cycle: "agent",
  action: "worker",
  observation: "worker",
  digest: "results",
  question: "results",
  correction: "results",
  system: "orchestrator",
};

export interface PilotStage {
  mode: PilotStageMode;
  /** The node currently doing work (or resting at the orchestrator when idle). */
  activeNode: PilotStageNode;
  /** e.g. "wakes in 43m" - only while sleeping. */
  sleepLabel: string | null;
  topAgendaItem: string | null;
  /** Newest journal summary, ISO timestamps humanized. */
  latestAction: string | null;
  appliedToday: number;
  dailyCap: number;
}

/**
 * Derives the orchestration diagram's state from data the overview already holds -
 * pilot state, hoisted terminal health, the shared live journal buffer, and the
 * cached agenda query. Opens no new poller or SSE connection.
 */
export function usePilotStage(): PilotStage {
  const { state, health, hostStatus } = usePilotStatus();

  // Same cached key the Activity feed / RecentActivity use; the live buffer shares
  // the refcounted pilot SSE connection, so nothing new is fetched here.
  const journal = useApiQuery(pilotQueries.journal());
  const { entries: live } = useJournalLive();
  // Shared with the status hero so the diagram and the card can't disagree on the countdown.
  const nextWakeAt = useNextWake();
  // Same query key + staleTime as AgendaPreview, so this never triggers an extra compile.
  const agenda = useApiQuery(pilotQueries.agenda(), {
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const newest = live[0] ?? journal.data?.items[0] ?? null;
  const conducting = hostStatus?.pilot?.conducting ?? false;

  let mode: PilotStageMode;
  if (!state.running) {
    mode = "off";
  } else if (isHostOffline(health)) {
    mode = "offline";
  } else if (conducting) {
    mode = "working";
  } else {
    mode = "sleeping";
  }

  const activeNode: PilotStageNode =
    mode === "working" && newest ? NODE_BY_KIND[newest.kind] : "orchestrator";

  const sleepLabel =
    mode === "sleeping" && nextWakeAt ? `wakes in ${formatTimeUntil(nextWakeAt)}` : null;

  return {
    mode,
    activeNode,
    sleepLabel,
    topAgendaItem: agenda.data?.items[0]?.title ?? null,
    latestAction: newest ? humanizeIsoInText(newest.summary) : null,
    appliedToday: state.appliedToday,
    dailyCap: state.instructionsConfig.dailyApplyCap,
  };
}
