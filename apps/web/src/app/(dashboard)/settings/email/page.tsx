import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmailSection } from "@/components/features/settings/sections";

export const metadata: Metadata = { title: "Email" };

export default function EmailSettingsPage(): ReactElement {
  return <EmailSection />;
}
