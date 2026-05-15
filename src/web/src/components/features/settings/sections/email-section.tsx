"use client";

import { useState, type ReactElement } from "react";
import { Box, Button, MenuItem, Select, Stack, Typography } from "@mui/material";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EmailAccountStatus } from "@/types/api";

export function EmailSection(): ReactElement {
  const [provider, setProvider] = useState("gmail");
  const [pendingDisconnect, setPendingDisconnect] = useState(false);

  const status = useApiQuery<EmailAccountStatus>(queryKeys.email.account(), () =>
    apiClient.get<EmailAccountStatus>("/api/email/account"),
  );

  const disconnect = useApiMutation<{ disconnected: boolean }, void>(
    () => apiClient.del<{ disconnected: boolean }>("/api/email/account"),
    {
      successMessage: "Email disconnected",
      invalidate: [queryKeys.email.all],
      onSuccess: () => setPendingDisconnect(false),
    },
  );

  if (status.isLoading || !status.data) {
    return (
      <SectionCard title="Email integration" description="Connect a mailbox.">
        <Typography variant="body2Muted">Loading…</Typography>
      </SectionCard>
    );
  }

  const data = status.data;

  if (data.connected) {
    const last = data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : "never";
    return (
      <SectionCard
        title="Email integration"
        description="JobPilot reads new mail to track replies and auto-fill verification codes."
      >
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.email}
            </Typography>
            <Typography variant="captionMuted">
              {data.provider} · last synced {last}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" color="error" onClick={() => setPendingDisconnect(true)}>
              Disconnect
            </Button>
          </Stack>
        </Stack>

        <ConfirmDialog
          open={pendingDisconnect}
          title="Disconnect mailbox?"
          message="JobPilot will stop reading new mail. Verification codes will fall back to asking you."
          confirmLabel="Disconnect"
          destructive
          onConfirm={() => disconnect.mutate(undefined as unknown as void)}
          onCancel={() => setPendingDisconnect(false)}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Email integration"
      description="Connect Gmail so JobPilot can track recruiter replies and auto-fill verification codes."
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
        <Button
          variant="contained"
          onClick={() => {
            window.location.href = `/api/email/oauth/start?provider=${provider}`;
          }}
        >
          Connect Gmail
        </Button>
        <Typography variant="captionMuted">
          Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env. See README.md.
        </Typography>
      </Stack>
    </SectionCard>
  );
}
