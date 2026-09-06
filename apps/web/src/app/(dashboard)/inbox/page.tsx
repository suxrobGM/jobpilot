import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { EmailConnectToast, InboxContent } from "@/components/features/inbox";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Inbox" };

interface InboxPageProps {
  searchParams: Promise<{ emailConnect?: string; reason?: string }>;
}

export default function InboxPage(props: InboxPageProps): ReactElement {
  return (
    <PageShell maxWidth="lg">
      {/* Only the OAuth callback toast reads the URL; the inbox itself does not. */}
      <Suspense fallback={null}>
        <ConnectToast searchParams={props.searchParams} />
      </Suspense>
      <PageHeader
        eyebrow="Email"
        title="Inbox"
        description="Replies, rejections, and offers from the boards you applied to. Approve to update the matching application's status."
      />
      <InboxContent />
    </PageShell>
  );
}

async function ConnectToast(props: InboxPageProps): Promise<ReactElement> {
  const { emailConnect, reason } = await props.searchParams;
  return <EmailConnectToast status={emailConnect} reason={reason} />;
}
