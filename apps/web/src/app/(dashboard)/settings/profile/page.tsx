import type { ReactElement } from "react";
import type { Metadata } from "next";
import { SettingsContent } from "@/components/features/settings";

export const metadata: Metadata = { title: "Profile" };

export default function ProfileSettingsPage(): ReactElement {
  return <SettingsContent />;
}
