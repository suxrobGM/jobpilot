import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { EmailConnectToast, InboxContent } from "@/components/features/inbox";
import { PageHeader } from "@/components/ui/layout/page-header";

interface InboxPageProps {
  searchParams: Promise<{ emailConnect?: string; reason?: string }>;
}

export default async function InboxPage(props: InboxPageProps): Promise<ReactElement> {
  const { emailConnect, reason } = await props.searchParams;
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <EmailConnectToast status={emailConnect} reason={reason} />
      <PageHeader
        eyebrow="Email"
        title="Inbox"
        description="Replies, rejections, and offers from the boards you applied to. Approve to update the matching application's stage."
      />
      <InboxContent />
    </Container>
  );
}
