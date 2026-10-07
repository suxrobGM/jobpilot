"use client";

import type { ReactElement } from "react";
import { newTokens, sumTokenUsage } from "@jobpilot/contracts/pilot";
import { EastRounded } from "@mui/icons-material";
import { Box, Card, CardContent, Stack, Tooltip, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";
import { formatNewTokenParts, formatTokens } from "@/utils/format";
import { PILOT_MODE_LOOK } from "../pilot-status";
import { AGENT_LABELS, type PilotAgent, taskTypeAgent } from "../task-types";

export interface Stage {
  title: string;
  role: string;
  tone: PulseDotTone;
}

/** Required record, so a new agent fails typecheck instead of silently missing from the list. */
const AGENT_ROLES: Record<PilotAgent, string> = {
  "job-searcher": "Finds jobs",
  "job-scorer": "Scores jobs",
  "job-applier": "Applies to jobs",
  "networking-worker": "Reaches out",
  session: "Inbox, messages, posts",
};

const AGENTS = Object.keys(AGENT_ROLES) as PilotAgent[];

const DIM_OPACITY = 0.5;

interface StageCardProps {
  stage: Stage;
  caption: string;
  active?: boolean;
  dimmed: boolean;
}

export function StageCard(props: StageCardProps): ReactElement {
  const { stage, caption, active = false, dimmed } = props;

  return (
    <Card
      variant={active ? "accent" : undefined}
      sx={{ flex: { md: "1 1 0" }, minWidth: 0, opacity: dimmed ? DIM_OPACITY : 1 }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PulseDot tone={dimmed ? "muted" : stage.tone} size="sm" pulsing={active} />
          <Typography variant="body1Strong">{stage.title}</Typography>
        </Stack>
        <Typography variant="overlineMuted" sx={{ display: "block", ml: 2 }}>
          {stage.role}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.75,
            ml: 2,
            color: active ? "text.primary" : "text.secondary",
          }}
        >
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface AgentListProps {
  branch: PilotAgent | null;
  dimmed: boolean;
}

/** `branch` is the agent on the current run, shown lit. */
export function AgentList(props: AgentListProps): ReactElement {
  const { branch, dimmed } = props;
  const cost = useApiQuery(pilotQueries.cost());

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
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
          gap: 1,
        }}
      >
        {AGENTS.map((agent) => {
          const active = agent === branch;
          const usage = sumTokenUsage((costByAgent.get(agent) ?? []).map((item) => item.tokens));
          return (
            <Card
              key={agent}
              variant={active ? "accent" : undefined}
              sx={{ px: 1.5, py: 1, opacity: branch !== null && !active ? DIM_OPACITY : 1 }}
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

interface StageArrowProps {
  lit: boolean;
}

export function StageArrow(props: StageArrowProps): ReactElement {
  const { lit } = props;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        px: { md: 0.5 },
        py: { xs: 0.5, md: 0 },
        color: lit ? theme.palette.accent.primary : "text.disabled",
        transition: theme.transitions.create("color"),
      })}
    >
      <EastRounded fontSize="small" sx={{ transform: { xs: "rotate(90deg)", md: "none" } }} />
    </Box>
  );
}
