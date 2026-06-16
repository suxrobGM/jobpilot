"use client";

import { useState, type ReactElement } from "react";
import { Alert, Box, Button, MenuItem, Select, Stack, Typography } from "@mui/material";
import { api } from "@/api/eden";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { EmailAccountStatus } from "@/api/types";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout/section-card";

export function EmailSection(): ReactElement {
  const [provider, setProvider] = useState("gmail");
  const [pendingDisconnect, setPendingDisconnect] = useState(false);

  const status = useApiQuery<EmailAccountStatus>(queryKeys.email.account(), () =>
    api.email.account.get(),
  );

  const disconnect = useApiMutation<{ disconnected: boolean }, void>(
    () => api.email.account.delete(),
    {
      successMessage: "Email disconnected",
      invalidate: [queryKeys.email.all],
      onSuccess: () => setPendingDisconnect(false),
    },
  );

  if (status.isLoading || !status.data) {
    return (
      <SectionCard title="Email integration" description="Connect a mailbox.">
        <Typography variant="body2Muted">Loading</Typography>
      </SectionCard>
    );
  }

  const data = status.data;

  if (data.connected) {
    const last = data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : "never";
    return (
      <SectionCard
        title="Email integration"
        description="JobPilot reads new mail to track replies and auto-fill verification codes, and sends outreach emails on your behalf."
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
          {!data.canSend && (
            <Alert severity="info">
              This mailbox is read-only, so outreach can&apos;t send email yet. Add the{" "}
              <code>gmail.send</code> scope under Google Auth Platform → Data access (see README →
              Email Integration), then use <strong>Reconnect to enable sending</strong> below to
              grant send access.
            </Alert>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button
              variant={data.canSend ? "outlined" : "contained"}
              onClick={() => {
                window.location.href = `/api/email/oauth/start?provider=${data.provider ?? "gmail"}`;
              }}
            >
              {data.canSend ? "Reconnect" : "Reconnect to enable sending"}
            </Button>
            <Button variant="outlined" color="error" onClick={() => setPendingDisconnect(true)}>
              Disconnect
            </Button>
          </Stack>
        </Stack>

        <ConfirmDialog
          open={pendingDisconnect}
          title="Disconnect mailbox?"
          description="JobPilot will stop reading new mail. Verification codes will fall back to asking you."
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
