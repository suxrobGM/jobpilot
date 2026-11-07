import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InboxList, UpworkHeader } from "@/components/features/upwork";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork inbox" };

export default function UpworkInboxPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <UpworkHeader />
      <InboxList />
    </PageShell>
  );
}
