import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProfileSettingsForm } from "@/components/features/settings";

export const metadata: Metadata = { title: "Profile" };

export default function ProfileSettingsPage(): ReactElement {
  return <ProfileSettingsForm />;
}
