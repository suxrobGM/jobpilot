import type { ReactElement } from "react";
import { serverApi } from "@/api/server-api";
import { SettingsContent } from "@/components/features/settings";

export default async function ProfileSettingsPage(): Promise<ReactElement> {
  const api = await serverApi();
  const { data } = await api.profile.get();

  return <SettingsContent initialProfile={data ?? undefined} />;
}
