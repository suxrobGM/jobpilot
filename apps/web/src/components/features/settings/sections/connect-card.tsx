"use client";

import { type ReactElement, useState } from "react";
import { Alert, Box, Button, MenuItem, Select, Stack, Typography } from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { LoadingSpinner } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useConfirm } from "@/providers/confirm-provider";

/**
 * Step 2 - connect / reconnect / disconnect the mailbox (gated on a saved
 * client). Reads the mailbox status and client config (shared keys dedupe
 * with the OAuth client card).
 */
export function ConnectCard(): ReactElement {
  const [provider, setProvider] = useState("gmail");
  const confirm = useConfirm();

  const statusQuery = useApiQuery(emailQueries.account());
  const configQuery = useApiQuery(emailQueries.oauthClient());

  const disconnect = useApiMutation<{ disconnected: boolean }, void>(
    () => api.email.account.delete(),
    { successMessage: "Email disconnected", invalidate: [queryKeys.email.all] },
  );

  const connect = (p: string): void => {
    window.location.href = `${API_BASE_URL}/api/email/oauth/start?provider=${p}`;
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
        description="Connect a mailbox so JobPilot can track replies, auto-fill verification codes, and send outreach."
      >
        <LoadingSpinner />
      </SectionCard>
    );
  }

  const status = statusQuery.data;
  const configured = configQuery.data.configured;

  if (status.connected) {
    const last = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "never";
    return (
      <SectionCard
        title="Email integration"
        description="JobPilot reads new mail to track replies and auto-fill verification codes, and sends outreach emails on your behalf."
      >
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {status.email}
            </Typography>
            <Typography variant="captionMuted">
              {status.provider} · last synced {last}
            </Typography>
          </Box>
          {!configured && (
            <Alert severity="warning">
              Add your Google OAuth client above before reconnecting.
            </Alert>
          )}
          {configured && !status.canSend && (
            <Alert severity="info">
              This mailbox is read-only, so outreach can&apos;t send email yet. Add the{" "}
              <code>gmail.send</code> scope to your OAuth client, then use{" "}
              <strong>Reconnect to enable sending</strong> below.
            </Alert>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button
              variant={status.canSend ? "outlined" : "contained"}
              disabled={!configured}
              onClick={() => connect(status.provider ?? "gmail")}
            >
              {status.canSend ? "Reconnect" : "Reconnect to enable sending"}
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
      description="Connect Gmail so JobPilot can track recruiter replies, auto-fill verification codes, and send outreach emails."
    >
      <Stack spacing={1.5} sx={{ maxWidth: 360 }}>
        <Select size="small" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <MenuItem value="gmail">Gmail</MenuItem>
          <MenuItem value="outlook" disabled>
            Outlook (coming soon)
          </MenuItem>
          <MenuItem value="imap" disabled>
            IMAP (coming soon)
          </MenuItem>
        </Select>
        {!configured && (
          <Alert severity="info">Save your Google OAuth client above first, then connect.</Alert>
        )}
        <Button variant="contained" disabled={!configured} onClick={() => connect(provider)}>
          Connect Gmail
        </Button>
      </Stack>
    </SectionCard>
  );
}
