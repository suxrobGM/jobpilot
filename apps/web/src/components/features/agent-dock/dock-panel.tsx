"use client";

import type { ReactElement } from "react";
import { ChevronRight, RestartAlt, StopCircle } from "@mui/icons-material";
import {
  IconButton,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { TerminalPanel } from "@/components/features/terminal";
import { LoadingSpinner, PulseDot } from "@/components/ui/feedback";
import { readAgentStorage } from "@/lib/agent-storage";
import { providerDisplayName } from "@/lib/terminal";
import { useAgentDock } from "@/providers/agent-provider";
import { AgentInstallCard } from "./agent-install-card";
import { AgentOfflineCard } from "./agent-offline-card";
import { AgentOrb } from "./agent-orb";
import { PendingRestartCard } from "./update/pending-restart-card";
import { AgentUpdateBanner } from "./update/update-banner";
import { useDockHealth } from "./use-dock-health";
import type { TerminalHealth } from "./use-terminal-health";

const STATUS_LABELS: Record<TerminalHealth, string> = {
  checking: "connecting",
  reachable: "ready",
  degraded: "needs reinstall",
  offline: "offline",
  uninstalled: "not installed",
};

export function DockPanel(): ReactElement {
  const { collapse, provider, switchProvider, restart, stop, terminalRevision } = useAgentDock();
  const { health, status, recheck, pending, beginPending, unreachable } = useDockHealth();
  const providerLabel = providerDisplayName(provider);

  const statusLabel = pending && unreachable ? `${pending}…` : STATUS_LABELS[health];

  const handleProviderChange = (event: SelectChangeEvent<string>): void => {
    void switchProvider(event.target.value === "codex" ? "codex" : "claude");
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
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
          <AgentOrb size="xxl" />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Agent
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", marginTop: "2px" }}>
              <PulseDot
                tone="muted"
                pulsing={health === "checking" || (pending !== null && unreachable)}
                size="xs"
              />
              <Typography variant="overlineMuted">{statusLabel}</Typography>
              {status?.hostVersion && (
                <Typography variant="overlineMuted">· v{status.hostVersion}</Typography>
              )}
            </Stack>
          </Stack>
        </Stack>
        <IconButton size="small" onClick={collapse} aria-label="Collapse agent dock">
          <ChevronRight fontSize="md" />
        </IconButton>
      </Stack>

      {health === "checking" && (
        <Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LoadingSpinner />
        </Stack>
      )}
      {health === "offline" &&
        (pending ? (
          <PendingRestartCard action={pending} />
        ) : (
          <AgentOfflineCard
            onRecheck={recheck}
            onStart={() => beginPending("starting")}
            provider={provider}
            // Live status while warm-offline; the persisted copy covers a cold reload (status is null then).
            canRelaunch={status?.canRelaunch ?? readAgentStorage()?.canRelaunch ?? false}
          />
        ))}
      {health === "uninstalled" && <AgentInstallCard onRecheck={recheck} />}
      {health === "degraded" && (
        <AgentInstallCard
          onRecheck={recheck}
          title="Reinstall the JobPilot agent"
          description="The agent host is running but its plugin files are missing or corrupt. Re-run setup to refresh it, then recheck."
          detail={status?.detail}
        />
      )}
      {health === "reachable" && (
        <>
          {status && (
            <AgentUpdateBanner
              currentVersion={status.hostVersion}
              provider={provider}
              canUpdate={status.canUpdate}
              onUpdated={recheck}
              onUpdating={() => beginPending("updating")}
            />
          )}
          <Stack
            direction="row"
            spacing={0.75}
            sx={(theme) => ({
              alignItems: "center",
              paddingInline: theme.spacing(1.5),
              paddingBlock: theme.spacing(0.75),
              borderBottom: `1px solid ${theme.palette.line.divider}`,
            })}
          >
            <Typography variant="captionMuted" sx={{ flex: 1 }}>
              {providerLabel}
            </Typography>
            <Select
              size="small"
              value={provider}
              onChange={handleProviderChange}
              sx={{ minWidth: 120, fontSize: "0.75rem" }}
            >
              <MenuItem value="claude">Claude Code</MenuItem>
              <MenuItem value="codex">Codex</MenuItem>
            </Select>
            <Tooltip title={`Restart ${providerLabel}`}>
              <IconButton size="small" onClick={() => void restart()} aria-label="Restart">
                <RestartAlt fontSize="sm" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Stop agent (closes the terminal app)">
              <IconButton
                size="small"
                onClick={() => {
                  beginPending("stopping");
                  void stop();
                }}
                aria-label="Stop"
              >
                <StopCircle fontSize="sm" />
              </IconButton>
            </Tooltip>
          </Stack>
          <TerminalPanel key={`${provider}-${terminalRevision}`} provider={provider} />
        </>
      )}
    </Stack>
  );
}
