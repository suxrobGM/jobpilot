import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { ConnectCard, OAuthClientCard } from "@/components/features/settings/sections";

export default async function EmailSettingsPage(): Promise<ReactElement> {
  const opts = await getFetchOptions();

  const [client, account] = await Promise.all([
    api.email.oauth.client.get(opts),
    api.email.account.get(opts),
  ]);
  const config = client.data ?? undefined;
  const status = account.data ?? undefined;

  return (
    <Stack spacing={3}>
      <OAuthClientCard initialConfig={config} initialStatus={status} />
      <ConnectCard initialStatus={status} initialConfig={config} />
    </Stack>
  );
}
