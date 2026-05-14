"use client";

import type { ReactElement, SyntheticEvent } from "react";
import { ChevronRight } from "@mui/icons-material";
import { IconButton, Stack, Tab, Tabs, Typography } from "@mui/material";
import { PilotOrb } from "@/components/ui/display";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";
import { useAgent, type AgentStatus, type AgentTab } from "@/providers/agent-provider";
import { DockTabEvents } from "./dock-tab-events";
import { DockTabPilot } from "./dock-tab-pilot";
import { DockTabTerminal } from "./dock-tab-terminal";

interface StatusCopy {
  label: string;
  pulsing: boolean;
  tone: PulseDotTone;
}

function statusCopy(status: AgentStatus): StatusCopy {
  switch (status) {
    case "working":
      return { label: "working", pulsing: true, tone: "violet" };
    case "awaiting-input":
      return { label: "awaiting you", pulsing: true, tone: "amber" };
    case "error":
      return { label: "needs help", pulsing: false, tone: "red" };
    case "idle":
    default:
      return { label: "ready", pulsing: false, tone: "muted" };
  }
}

export function DockPanel(): ReactElement {
  const { activeTab, setActiveTab, collapse, status } = useAgent();
  const { label, pulsing, tone } = statusCopy(status);

  const handleChange = (_: SyntheticEvent, next: AgentTab): void => {
    setActiveTab(next);
  };

  return (
    <Stack sx={{ width: "100%", height: "100%", minHeight: 0 }}>
      <Stack
        direction="row"
        sx={(theme) => ({
          alignItems: "center",
          paddingInline: theme.spacing(1.75),
          paddingBlock: theme.spacing(1.25),
          borderBottom: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <PilotOrb size={28} />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Pilot
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", marginTop: "2px" }}>
              <PulseDot tone={tone} pulsing={pulsing} size="xs" />
              <Typography variant="overlineMuted">{label}</Typography>
            </Stack>
          </Stack>
        </Stack>
        <IconButton size="small" onClick={collapse} aria-label="Collapse Pilot">
          <ChevronRight fontSize="md" />
        </IconButton>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={(theme) => ({
          minHeight: 36,
          paddingInline: theme.spacing(1),
          borderBottom: `1px solid ${theme.palette.line.divider}`,
          "& .MuiTab-root": {
            minHeight: 36,
            paddingInline: theme.spacing(1.25),
            paddingBlock: theme.spacing(0.75),
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.06em",
            textTransform: "lowercase",
          },
        })}
      >
        <Tab value="pilot" label="pilot" />
        <Tab value="terminal" label="terminal" />
        <Tab value="events" label="events" />
      </Tabs>

      {activeTab === "pilot" && <DockTabPilot />}
      {activeTab === "terminal" && <DockTabTerminal />}
      {activeTab === "events" && <DockTabEvents />}
    </Stack>
  );
}
