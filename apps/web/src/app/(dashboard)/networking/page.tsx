import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ContactsTable } from "@/components/features/networking";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Networking" };

export default function NetworkingPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Networking"
        title="Contacts"
        description="Hiring managers and recruiters discovered across your networking campaigns. Start a campaign in Networking mode to find more."
      />
      <ContactsTable />
    </PageShell>
  );
}
