import type { ReactElement } from "react";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { CredentialsSection } from "@/components/features/settings";

export default async function CredentialsSettingsPage(): Promise<ReactElement> {
  const opts = await getFetchOptions();
  const { data } = await api.credentials.get(opts);

  return <CredentialsSection initialCredentials={data ?? undefined} />;
}
