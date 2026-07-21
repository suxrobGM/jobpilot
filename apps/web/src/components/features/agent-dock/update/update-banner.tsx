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
import { providerDisplayName, type TerminalProviderId, triggerUpdate } from "@/lib/terminal";
import { UpdateManualSteps } from "./manual-steps";
import { isNewer, useLatestRelease } from "./use-latest-release";

type UpdatePhase = "idle" | "updating" | "restarting" | "error";

interface AgentUpdateBannerProps {
  currentVersion: string;
  provider: TerminalProviderId;
  /** Re-probe host health after triggering an update, so the banner clears once the new version is live. */
  onUpdated: () => void;
  /** The host accepted the update and is restarting - the dock shows its updating state and polls fast. */
  onUpdating: () => void;
  /** False in a dev checkout - the one-click update is unavailable, so show manual steps only. */
  canUpdate?: boolean;
}

/**
 * Checks GitHub for the latest terminal release; when behind, offers a one-click self-update (the host
 * swaps + relaunches) and falls back to the manual plugin + setup path when that isn't available.
 */
export function AgentUpdateBanner(props: AgentUpdateBannerProps): ReactNode {
  const { currentVersion, provider, onUpdated, onUpdating, canUpdate } = props;
  const providerLabel = providerDisplayName(provider);
  const latest = useLatestRelease();
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
        onUpdated();
        return;
      }
      // dev-checkout / no-asset / up-to-date - fall back to the manual steps.
      const upToDate = result.reason === "up-to-date";
      setShowManual(true);
      setPhase(upToDate ? "idle" : "error");
      if (upToDate) {
        onUpdated();
      }
    } catch {
      setShowManual(true);
      setPhase("error");
    }
  };

  if (dismissed || !latest || !currentVersion || !isNewer(latest, currentVersion)) {
    return null;
  }

  const manualOnly = canUpdate === false;

  return (
    <Alert
      severity="info"
      sx={{ borderRadius: "0px", py: 0.5, "& .MuiAlert-message": { width: "100%" } }}
      action={
        <IconButton
          size="small"
          aria-label="Dismiss update notice"
          onClick={() => setDismissed(true)}
        >
          <Close fontSize="small" />
        </IconButton>
      }
    >
      <Stack spacing={1}>
        <Typography variant="captionMuted">
          Agent update available - v{latest} (you have v{currentVersion}).
        </Typography>

        {phase === "restarting" ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={14} />
            <Typography variant="captionMuted">Restarting the agent on v{latest}…</Typography>
          </Stack>
        ) : manualOnly ? (
          <>
            <Typography variant="captionMuted">In {providerLabel}:</Typography>
            <UpdateManualSteps provider={provider} />
          </>
        ) : (
          <>
            <Typography variant="captionMuted">
              Updating restarts the agent and stops any running session.
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={phase === "updating"}
              onClick={() => void handleUpdate()}
              startIcon={
                phase === "updating" ? <CircularProgress size={14} color="inherit" /> : undefined
              }
              sx={{ alignSelf: "flex-start" }}
            >
              {phase === "updating" ? "Updating…" : "Update now"}
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
