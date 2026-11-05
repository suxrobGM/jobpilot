"use client";

import type { ReactElement, ReactNode } from "react";
import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { pilotQueries } from "@/api/queries";
import {
  PILOT_HOST_OFFLINE_MESSAGE,
  PILOT_MODE_LOOK,
  pilotMode,
} from "@/components/features/pilot/pilot-status";
import { LinkButton } from "@/components/ui/buttons";
import { RelativeTime } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import type { PilotHealth } from "@/lib/terminal";
import { useAgentAvailable } from "@/providers/agent-provider";
import { plural } from "@/utils/format";
import { type TerminalHealth, useTerminalHealth } from "../../agent-dock/use-terminal-health";
import { useOpenQuestions } from "../../pilot/attention/use-open-questions";

/** Compact read-only pilot presence for the workspace overview; controls live on /pilot. */
export function PilotStatusCard(): ReactElement {
  const agentAvailable = useAgentAvailable();
  // Split so the host poller never mounts on mobile, where no local host can exist.
  return agentAvailable ? <PilotCardWithHost /> : <PilotCardBody health={null} pilot={null} />;
}

function PilotCardWithHost(): ReactElement {
  const { health, status } = useTerminalHealth();
  return <PilotCardBody health={health} pilot={status?.pilot ?? null} />;
}

interface PilotCardBodyProps {
  health: TerminalHealth | null;
  pilot: PilotHealth | null;
}

function PilotCardBody(props: PilotCardBodyProps): ReactNode {
  const { health, pilot } = props;
  const stateQuery = useQuery(pilotQueries.state());
  const openQuestions = useOpenQuestions().questions.length;

  const state = stateQuery.data;
  if (!state) return null;

  const mode = pilotMode(state, health, pilot);
  const look = PILOT_MODE_LOOK[mode];
  const { dailyApplyCap } = state.instructionsConfig;

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.5, sm: 3 }}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
            <PulseDot tone={look.tone} pulsing={look.pulsing} />
            <Typography variant="body1Strong">Pilot</Typography>
            <Typography variant="body2Muted">{look.label}</Typography>
            {openQuestions > 0 && (
              <Chip
                component={Link}
                href="/pilot"
                clickable
                color="warning"
                label={`${plural(openQuestions, "question")} for you`}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
            <Typography variant="body2Muted">
              Applied today{" "}
              <Typography
                component="span"
                variant="body2"
                color={state.capReached ? "error" : "textPrimary"}
              >
                {state.appliedToday} / {dailyApplyCap}
              </Typography>
            </Typography>
            {state.lastCycleAt && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "baseline" }}>
                <Typography variant="body2Muted">Last cycle</Typography>
                <RelativeTime value={state.lastCycleAt} variant="body2" />
              </Stack>
            )}
            <LinkButton size="small" variant="outlined" href="/pilot">
              Open
            </LinkButton>
          </Stack>
        </Stack>
        {mode === "offline" && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {PILOT_HOST_OFFLINE_MESSAGE}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
