import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProfileSettingsForm } from "@/components/features/settings";

export const metadata: Metadata = { title: "Application answers" };

export default function ApplicationAnswersPage(): ReactElement {
  return <ProfileSettingsForm page="answers" />;
}
