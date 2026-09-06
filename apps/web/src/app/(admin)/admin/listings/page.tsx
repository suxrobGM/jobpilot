import { type ReactElement, Suspense } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AdminListingsTable, AdminSearchField } from "@/components/features/admin";
import { PaginationControls, TableSkeleton } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { type PaginationSearchParams, paginationQuery } from "@/utils/search-params";

export const metadata: Metadata = { title: "Listings" };

interface AdminListingsPageProps {
  searchParams: Promise<PaginationSearchParams & { q?: string }>;
}

/** Moderation for the public job index. */
export default function AdminListingsPage(props: AdminListingsPageProps): ReactElement {
  return (
    <SectionCard
      title="Job listings"
      description="The public, deduped job index behind /jobs. Hiding a listing removes it from the public pages but keeps the row, so a re-scrape does not resurrect it."
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <AdminSearchField placeholder="Search title or company" />
      </Stack>

      <Suspense fallback={<TableSkeleton />}>
        <AdminListings searchParams={props.searchParams} />
      </Suspense>
    </SectionCard>
  );
}

async function AdminListings(props: AdminListingsPageProps): Promise<ReactElement> {
  const search = await props.searchParams;

  const { data } = await api.admin.listings.get({
    query: {
      ...paginationQuery(search),
      ...(search.q?.trim() && { q: search.q.trim() }),
    },
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <>
      <AdminListingsTable listings={data.items} />
      <PaginationControls pagination={data.pagination} />
    </>
  );
}
