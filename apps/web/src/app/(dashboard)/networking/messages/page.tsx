import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { NetworkingMessagesList } from "@/components/features/networking";
import { TableSkeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Outreach messages" };

export default function NetworkingMessagesPage(): ReactElement {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <NetworkingMessagesList />
    </Suspense>
  );
}
