"use client";

import type { ReactElement } from "react";
import type { EmailProvider } from "@jobpilot/contracts/email";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { emailQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { LoadingSpinner } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { formatAbsoluteTime } from "@/utils/format";
import { MailboxReauthAlert } from "./mailbox-reauth-alert";

/**
 * Step 2 - connect / reconnect / disconnect the mailbox (gated on a saved
 * client). Reads the mailbox status and client config (shared keys dedupe
 * with the OAuth client card).
 */
export function ConnectCard({ provider }: { provider: EmailProvider }): ReactElement {
  const confirm = useConfirm();

  const statusQuery = useQuery(emailQueries.account());
  const configQuery = useQuery(emailQueries.oauthClient(provider));

  const disconnect = useApiMutation(() => api.email.account.delete(), {
    successMessage: "Email disconnected",
    invalidate: [emailQueries.all],
  });

  const connect = (): void => {
    window.location.href = `${API_BASE_URL}/api/email/oauth/authorize?provider=${provider}`;
  };

  const handleDisconnect = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Disconnect mailbox?",
      description:
        "JobPilot will stop reading new mail. Verification codes will fall back to asking you.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (confirmed) {
      disconnect.mutate();
    }
  };

  if (!statusQuery.data || !configQuery.data) {
    return (
      <SectionCard
        title="Email integration"
        description="Connect a mailbox so JobPilot can track replies, auto-fill verification codes, and send networking messages."
      >
        <LoadingSpinner />
      </SectionCard>
    );
  }

  const status = statusQuery.data;
  const configured = configQuery.data.configured;

  if (status.connected) {
    const last = status.lastSyncAt ? formatAbsoluteTime(status.lastSyncAt) : "never";
    return (
      <SectionCard
        title="Email integration"
        description="JobPilot reads new mail to track replies and auto-fill verification codes, and sends networking emails on your behalf."
      >
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="body2Strong">{status.email}</Typography>
            <Typography variant="captionMuted">
              {status.provider === "microsoft" ? "Microsoft 365" : "Gmail"} · last synced {last}
            </Typography>
          </Box>
          {status.signedInEmail && (
            <Typography variant="captionMuted">Signed in as {status.signedInEmail}</Typography>
          )}
          {status.provider !== provider && (
            <Alert severity="info">
              Disconnect this mailbox before connecting the selected provider.
            </Alert>
          )}
          {status.needsReauth && <MailboxReauthAlert />}
          {!configured && (
            <Alert severity="warning">
              Add this provider’s OAuth client above before reconnecting.
            </Alert>
          )}
          {configured && !status.canSend && (
            <Alert severity="info">
              This mailbox is read-only. Enable sending in its OAuth configuration and reconnect
              only if you want JobPilot to send mail.
            </Alert>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button
              variant={status.canSend ? "outlined" : "contained"}
              disabled={!configured || status.provider !== provider}
              onClick={connect}
            >
              Reconnect
            </Button>
            <Button variant="outlined" color="error" onClick={() => void handleDisconnect()}>
              Disconnect
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Email integration"
      description="Connect a mailbox so JobPilot can track recruiter replies and read application emails. Sending requires its own permission."
    >
      <Stack spacing={1.5} sx={{ maxWidth: 360 }}>
        {!configured && (
          <Alert severity="info">
            Save this provider’s OAuth client above first, then connect.
          </Alert>
        )}
        <Button variant="contained" disabled={!configured} onClick={connect}>
          Connect {provider === "microsoft" ? "Microsoft 365" : "Gmail"}
        </Button>
      </Stack>
    </SectionCard>
  );
}
