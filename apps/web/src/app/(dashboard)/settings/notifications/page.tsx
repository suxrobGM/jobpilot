import type { ReactElement } from "react";
import type { Metadata } from "next";
import { NotificationsCard } from "@/components/features/settings";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationSettingsPage(): ReactElement {
  return <NotificationsCard />;
}
