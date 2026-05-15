"use client";

import type { ReactElement, SyntheticEvent } from "react";
import { ChevronRight } from "@mui/icons-material";
import { IconButton, Stack, Tab, Tabs, Typography } from "@mui/material";
import { PilotOrb } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import { useAgent, type AgentTab } from "@/providers/agent-provider";
import { DockTabEvents } from "./dock-tab-events";
import { DockTabTerminal } from "./dock-tab-terminal";

export function DockPanel(): ReactElement {
  const { activeTab, setActiveTab, collapse } = useAgent();

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
          <PilotOrb size="xxl" />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Agent
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", marginTop: "2px" }}>
              <PulseDot tone="muted" pulsing={false} size="xs" />
              <Typography variant="overlineMuted">ready</Typography>
            </Stack>
          </Stack>
        </Stack>
        <IconButton size="small" onClick={collapse} aria-label="Collapse agent dock">
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
        <Tab value="terminal" label="terminal" />
        <Tab value="events" label="events" />
      </Tabs>

      <DockTabTerminal hidden={activeTab !== "terminal"} />
      {activeTab === "events" && <DockTabEvents />}
    </Stack>
  );
}
