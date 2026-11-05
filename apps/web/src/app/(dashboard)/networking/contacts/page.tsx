import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { ContactsList } from "@/components/features/networking";
import { TableSkeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Contacts" };

export default function NetworkingContactsPage(): ReactElement {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ContactsList />
    </Suspense>
  );
}
