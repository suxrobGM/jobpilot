import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmailConnectToast, InboxContent } from "@/components/features/inbox";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Inbox" };

interface InboxPageProps {
  searchParams: Promise<{ emailConnect?: string; reason?: string }>;
}

export default async function InboxPage(props: InboxPageProps): Promise<ReactElement> {
  const { emailConnect, reason } = await props.searchParams;
  return (
    <PageShell maxWidth="lg">
      <EmailConnectToast status={emailConnect} reason={reason} />
      <PageHeader
        eyebrow="Email"
        title="Inbox"
        description="Replies, rejections, and offers from the boards you applied to. Approve to update the matching application's status."
      />
      <InboxContent />
    </PageShell>
  );
}
