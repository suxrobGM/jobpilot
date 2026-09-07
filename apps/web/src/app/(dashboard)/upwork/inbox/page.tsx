import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InboxList } from "@/components/features/upwork";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork inbox" };

export default function UpworkInboxPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Upwork"
        title="Inbox"
        description="Invitations, offers and message threads mirrored from Upwork by the upwork-sync skill."
        backHref="/upwork"
        backLabel="Upwork"
      />
      <InboxList />
    </PageShell>
  );
}
