"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { api } from "@/api/eden";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { EmailAccountStatus, OAuthClientStatus } from "@/api/types";
import { SectionCard } from "@/components/ui/layout/section-card";
import { ConnectCard } from "./connect-card";
import { OAuthClientCard } from "./oauth-client-card";

export function EmailSection(): ReactElement {
  const config = useApiQuery<OAuthClientStatus>(queryKeys.email.oauthClient(), () =>
    api.email.oauth.client.get(),
  );
  const status = useApiQuery<EmailAccountStatus>(queryKeys.email.account(), () =>
    api.email.account.get(),
  );

  if (!config.data || !status.data) {
    return (
      <SectionCard title="Email integration" description="Connect a mailbox.">
        <Typography variant="body2Muted">Loading…</Typography>
      </SectionCard>
    );
  }

  return (
    <Stack spacing={3}>
      <OAuthClientCard config={config.data} connected={status.data.connected} />
      <ConnectCard status={status.data} configured={config.data.configured} />
    </Stack>
  );
}
