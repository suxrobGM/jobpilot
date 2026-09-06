import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { EmailConnectToast, InboxContent } from "@/components/features/inbox";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      {/* Only the OAuth callback toast reads the URL, and it reads it client-side. */}
      <Suspense fallback={null}>
        <EmailConnectToast />
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
