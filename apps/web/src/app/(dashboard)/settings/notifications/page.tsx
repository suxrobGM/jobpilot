import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PushSettings } from "@/components/features/settings/sections";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationSettingsPage(): ReactElement {
  return <PushSettings />;
}
