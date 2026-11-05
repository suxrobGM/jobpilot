"use client";

import { type ReactNode, useState } from "react";
import { Close } from "@mui/icons-material";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { recheckTerminalHealth } from "@/hooks/use-terminal-health";
import { providerDisplayName, triggerUpdate } from "@/lib/terminal/client";
import { useAgentDock } from "@/providers/agent-provider";
import { UpdateManualSteps } from "./manual-steps";
import { isNewerVersion, useLatestVersion } from "./use-latest-version";

type UpdatePhase = "idle" | "updating" | "restarting" | "error";

interface AgentUpdateBannerProps {
  currentVersion: string;
  /** The host accepted the update and is restarting - the dock shows its updating state and polls fast. */
  onUpdating: () => void;
  /** False in a dev checkout - the one-click update is unavailable, so show manual steps only. */
  canUpdate?: boolean;
}

/** When behind, offers the one-click self-update, else the manual plugin + setup path. */
export function AgentUpdateBanner(props: AgentUpdateBannerProps): ReactNode {
  const { currentVersion, onUpdating, canUpdate } = props;
  const { provider } = useAgentDock();
  const providerLabel = providerDisplayName(provider);
  const latest = useLatestVersion();
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [showManual, setShowManual] = useState(false);

  const handleUpdate = async (): Promise<void> => {
    setPhase("updating");
    try {
      const result = await triggerUpdate();
      if (result.updating || result.reason === "in-progress") {
        // The host is relaunching (here or in another tab); let the health poll ride it back to reachable.
        setPhase("restarting");
        onUpdating();
        recheckTerminalHealth();
        return;
      }
      // dev-checkout / no-asset / up-to-date - fall back to the manual steps.
      const upToDate = result.reason === "up-to-date";
      setShowManual(true);
      setPhase(upToDate ? "idle" : "error");
      if (upToDate) {
        recheckTerminalHealth();
      }
    } catch {
      setShowManual(true);
      setPhase("error");
    }
  };

  if (dismissed || !latest || !currentVersion || !isNewerVersion(latest, currentVersion)) {
    return null;
  }

  const manualOnly = canUpdate === false;

  const restarting = phase === "restarting";

  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 0, py: 0.5, "& .MuiAlert-message": { width: "100%" } }}
      action={
        <IconButton
          size="small"
          aria-label="Dismiss update notice"
          onClick={() => setDismissed(true)}
        >
          <Close fontSize="sm" />
        </IconButton>
      }
    >
      <Stack spacing={1}>
        <Typography variant="captionMuted">
          Agent update available - v{latest} (you have v{currentVersion}).
        </Typography>

        {restarting && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={14} />
            <Typography variant="captionMuted">Restarting the agent on v{latest}…</Typography>
          </Stack>
        )}
        {!restarting && manualOnly && (
          <>
            <Typography variant="captionMuted">In {providerLabel}:</Typography>
            <UpdateManualSteps provider={provider} />
          </>
        )}
        {!restarting && !manualOnly && (
          <>
            <Typography variant="captionMuted">
              Updating restarts the agent and stops any running session.
            </Typography>
            <Button
              size="small"
              variant="contained"
              loading={phase === "updating"}
              onClick={() => void handleUpdate()}
              sx={{ alignSelf: "flex-start" }}
            >
              Update now
            </Button>
            {phase === "error" && (
              <Typography variant="captionMuted" color="error">
                Automatic update failed - update manually in {providerLabel}:
              </Typography>
            )}
            {showManual ? (
              <UpdateManualSteps provider={provider} />
            ) : (
              <Link
                component="button"
                type="button"
                variant="captionMuted"
                underline="hover"
                onClick={() => setShowManual(true)}
                sx={{ alignSelf: "flex-start" }}
              >
                Prefer to update manually?
              </Link>
            )}
          </>
        )}
      </Stack>
    </Alert>
  );
}
