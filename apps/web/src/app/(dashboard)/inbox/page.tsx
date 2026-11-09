import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { EmailConnectToast } from "@/components/features/inbox/email-connect-toast";
import { InboxContent } from "@/components/features/inbox/inbox-content";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage(): ReactElement {
  return (
    <>
      {/* Only the OAuth callback toast reads the URL, and it reads it client-side. */}
      <Suspense fallback={null}>
        <EmailConnectToast />
      </Suspense>
      <InboxContent />
    </>
  );
}
