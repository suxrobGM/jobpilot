import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { serverApi } from "@/api/server-api";
import { ConnectCard, OAuthClientCard } from "@/components/features/settings/sections";

export default async function EmailSettingsPage(): Promise<ReactElement> {
  const api = await serverApi();
  const [client, account] = await Promise.all([
    api.email.oauth.client.get(),
    api.email.account.get(),
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
