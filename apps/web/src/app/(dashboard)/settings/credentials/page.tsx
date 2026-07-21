import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CredentialsSection } from "@/components/features/settings";

export const metadata: Metadata = { title: "Credentials" };

export default function CredentialsSettingsPage(): ReactElement {
  return <CredentialsSection />;
}
