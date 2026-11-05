"use client";

import type { ReactElement } from "react";
import { newTokens, sumTokenUsage } from "@jobpilot/contracts/pilot";
import { Box, Card, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { PulseDot } from "@/components/ui/feedback";
import { formatNewTokenParts, formatTokens } from "@/utils/format";
import { PILOT_MODE_LOOK } from "../pilot-status";
import { AGENT_LABELS, type PilotAgent, taskTypeAgent } from "../task-types";
import { DIM_OPACITY } from "./stage-card";

/** Required record, so a new agent fails typecheck instead of silently missing from the list. */
const AGENT_ROLES: Record<PilotAgent, string> = {
  "job-searcher": "Finds jobs",
  "job-researcher": "Finds jobs beyond your boards",
  "job-scorer": "Scores jobs",
  "job-applier": "Applies to jobs",
  "networking-worker": "Reaches out",
  session: "Inbox, messages, posts",
};

const AGENTS = Object.keys(AGENT_ROLES) as PilotAgent[];

interface AgentListProps {
  activeAgent: PilotAgent | null;
  dimmed: boolean;
}

export function AgentList(props: AgentListProps): ReactElement {
  const { activeAgent, dimmed } = props;
  const cost = useQuery(pilotQueries.cost());

  const costByAgent = Map.groupBy(cost.data?.items ?? [], (item) => taskTypeAgent(item.taskType));

  return (
    <Box sx={{ opacity: dimmed ? DIM_OPACITY : 1 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
        <Typography variant="overlineMuted">Agents</Typography>
        <Typography variant="overlineMuted">New tokens, last 7 days</Typography>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
          gap: 1,
        }}
      >
        {AGENTS.map((agent) => {
          const active = agent === activeAgent;
          const usage = sumTokenUsage((costByAgent.get(agent) ?? []).map((item) => item.tokens));
          return (
            <Card
              key={agent}
              variant={active ? "accent" : undefined}
              sx={{ px: 1.5, py: 1, opacity: activeAgent !== null && !active ? DIM_OPACITY : 1 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <PulseDot
                  tone={active ? PILOT_MODE_LOOK.working.tone : "muted"}
                  size="xs"
                  pulsing={active}
                />
                <Typography variant={active ? "body2Strong" : "body2"} sx={{ flex: 1 }}>
                  {AGENT_LABELS[agent]}
                </Typography>
                <Tooltip
                  title={`${formatNewTokenParts(usage)} · ${formatTokens(usage.cacheRead)} cached`}
                >
                  <Typography variant="captionMuted">{formatTokens(newTokens(usage))}</Typography>
                </Tooltip>
              </Stack>
              <Typography variant="captionMuted" noWrap sx={{ display: "block", ml: 2 }}>
                {AGENT_ROLES[agent]}
              </Typography>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
