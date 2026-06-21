import type { ReactElement } from "react";
import { serverApi } from "@/api/server-api";
import { CredentialsSection } from "@/components/features/settings";

export default async function CredentialsSettingsPage(): Promise<ReactElement> {
  const api = await serverApi();
  const { data } = await api.credentials.get();

  return <CredentialsSection initialCredentials={data ?? undefined} />;
}
