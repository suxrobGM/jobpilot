import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { MessageDetail } from "@/components/features/inbox/message-detail";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Message" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MessagePage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <Suspense fallback={<DetailSkeleton />}>
        <Message params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Message(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return <MessageDetail messageId={id} />;
}
