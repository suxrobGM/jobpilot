import type { ReactElement } from "react";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { SettingsContent } from "@/components/features/settings";

export default async function ProfileSettingsPage(): Promise<ReactElement> {
  const opts = await getFetchOptions();
  const { data } = await api.profile.get(opts);

  return <SettingsContent initialProfile={data ?? undefined} />;
}
