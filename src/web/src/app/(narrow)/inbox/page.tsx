import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { InboxContent } from "@/components/features/inbox";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function InboxPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="Email"
        title="Inbox"
        description="Replies, rejections, and offers from the boards you applied to. Approve to update the matching application's stage."
      />
      <InboxContent />
    </Stack>
  );
}
