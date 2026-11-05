"use client";

import { type ReactElement, useState } from "react";
import { type EmailProvider, emailProviderSchema } from "@jobpilot/contracts/email";
import { MenuItem, Stack, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { emailQueries } from "@/api/queries";
import { LoadingSpinner } from "@/components/ui/feedback";
import { ConnectCard } from "./connect-card";
import { OAuthClientCard } from "./oauth-client-card";

export function EmailSection(): ReactElement {
  const account = useQuery(emailQueries.account());
  if (!account.data) return <LoadingSpinner />;
  return (
    <ProviderSettings initialProvider={account.data.connected ? account.data.provider : "gmail"} />
  );
}

function ProviderSettings({ initialProvider }: { initialProvider: EmailProvider }): ReactElement {
  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  return (
    <Stack spacing={3}>
      <TextField
        select
        label="Email provider"
        value={provider}
        onChange={(event) => setProvider(emailProviderSchema.parse(event.target.value))}
      >
        <MenuItem value="gmail">Gmail</MenuItem>
        <MenuItem value="microsoft">Microsoft 365</MenuItem>
      </TextField>
      <OAuthClientCard provider={provider} />
      <ConnectCard provider={provider} />
    </Stack>
  );
}
