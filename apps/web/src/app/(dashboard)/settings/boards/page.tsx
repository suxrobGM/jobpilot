import type { ReactElement } from "react";
import type { Metadata } from "next";
import { BoardsSection, CredentialsSection } from "@/components/features/settings";

export const metadata: Metadata = { title: "Job boards & logins" };

export default function BoardsSettingsPage(): ReactElement {
  return (
    <>
      <BoardsSection />
      <CredentialsSection />
    </>
  );
}
