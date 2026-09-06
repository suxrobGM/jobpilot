import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AdminPilotsTable } from "@/components/features/admin";
import { PaginationControls, TableSkeleton } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { type PaginationSearchParams, paginationQuery } from "@/utils/search-params";

export const metadata: Metadata = { title: "Pilots" };

interface AdminPilotsPageProps {
  searchParams: Promise<PaginationSearchParams>;
}

/** `?page=` drives the server fetch; the query schema has no search field. */
export default function AdminPilotsPage(props: AdminPilotsPageProps): ReactElement {
  return (
    <SectionCard
      title="Pilot fleet"
      description="Every user's autonomous Pilot: enablement, cycle activity, and open questions."
    >
      <Suspense fallback={<TableSkeleton />}>
        <AdminPilots searchParams={props.searchParams} />
      </Suspense>
    </SectionCard>
  );
}

async function AdminPilots(props: AdminPilotsPageProps): Promise<ReactElement> {
  const { data } = await api.admin.pilots.get({
    query: paginationQuery(await props.searchParams),
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <>
      <AdminPilotsTable pilots={data.items} />
      <PaginationControls pagination={data.pagination} />
    </>
  );
}
