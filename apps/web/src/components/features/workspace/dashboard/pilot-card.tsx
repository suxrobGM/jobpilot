"use client";

import type { ReactElement, ReactNode } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Alert, Chip, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import {
  isHostOffline,
  PILOT_HOST_OFFLINE_MESSAGE,
  PILOT_STARTING_UP_LABEL,
} from "@/components/features/pilot/host-status";
import { LinkButton } from "@/components/ui/buttons";
import { RelativeTime } from "@/components/ui/display";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import type { PilotHealth, SessionStatus } from "@/lib/terminal";
import { useAgentAvailable } from "@/providers/agent-provider";
import { type TerminalHealth, useTerminalHealth } from "../../agent-dock/use-terminal-health";
import { useOpenQuestions } from "../../pilot/attention/use-open-questions";

interface PilotIndicator {
  tone: PulseDotTone;
  label: string;
  pulsing?: boolean;
}

/** Precedence: off > host offline > working > starting up > connected > waiting > enabled. */
function deriveIndicator(
  enabled: boolean,
  cycleCount: number,
  health: TerminalHealth | null,
  pilot: PilotHealth | null,
): PilotIndicator {
  if (!enabled) return { tone: "muted", label: "Off" };
  if (isHostOffline(health)) return { tone: "amber", label: "Host offline" };
  if (pilot?.conducting) return { tone: "violet", label: "Working", pulsing: true };
  if (cycleCount === 0) return { tone: "blue", label: PILOT_STARTING_UP_LABEL, pulsing: true };
  if (pilot?.paired) return { tone: "green", label: "Connected" };
  if (health === "reachable") return { tone: "blue", label: "Waiting for agent" };
  // Mobile (no host visibility) or first probe still in flight.
  return { tone: "green", label: "Enabled" };
}

/** Compact read-only pilot presence for the workspace overview; controls live on /pilot. */
export function PilotStatusCard(): ReactElement {
  const agentAvailable = useAgentAvailable();
  // Split so the host poller never mounts on mobile, where no local host can exist.
  return agentAvailable ? <PilotCardWithHost /> : <PilotCardBody health={null} hostStatus={null} />;
}

function PilotCardWithHost(): ReactElement {
  const { health, status } = useTerminalHealth();
  return <PilotCardBody health={health} hostStatus={status} />;
}

interface PilotCardBodyProps {
  health: TerminalHealth | null;
  hostStatus: SessionStatus | null;
}

function PilotCardBody(props: PilotCardBodyProps): ReactNode {
  const { health, hostStatus } = props;
  const queryClient = useQueryClient();
  const stateQuery = useApiQuery(pilotQueries.state());
  const { count: openQuestions } = useOpenQuestions();

  // Rides the shared pilotChannel source (refcounted per URL), so this adds no connection.
  useSseChannel(pilotChannel, null, {
    on: {
      "state.changed": () => queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() }),
    },
  });

  const state = stateQuery.data;
  if (!state) return null;

  const indicator = deriveIndicator(
    state.enabled,
    state.cycleCount,
    health,
    hostStatus?.pilot ?? null,
  );
  const { dailyApplyCap } = state.instructionsConfig;

  return (
    <SectionCard
      title="Pilot"
      actions={
        <LinkButton size="small" variant="outlined" href="/pilot">
          Open
        </LinkButton>
      }
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PulseDot tone={indicator.tone} pulsing={indicator.pulsing} />
          <Typography variant="body2">{indicator.label}</Typography>
        </Stack>

        {indicator.tone === "amber" && (
          <Alert severity="warning">{PILOT_HOST_OFFLINE_MESSAGE}</Alert>
        )}

        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <Stack spacing={0.25}>
            <Typography variant="overlineMuted">Applied today</Typography>
            <Typography variant="body2" color={state.capReached ? "error.main" : "text.primary"}>
              {state.appliedToday} / {dailyApplyCap}
            </Typography>
          </Stack>
          <Stack spacing={0.25}>
            <Typography variant="overlineMuted">Last cycle</Typography>
            {state.lastCycleAt ? (
              <RelativeTime value={state.lastCycleAt} variant="body2" />
            ) : (
              <Typography variant="body2">-</Typography>
            )}
          </Stack>
          {openQuestions > 0 && (
            <Chip
              component={Link}
              href="/pilot"
              clickable
              color="warning"
              size="small"
              label={`${openQuestions} need${openQuestions === 1 ? "s" : ""} your answer`}
            />
          )}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
