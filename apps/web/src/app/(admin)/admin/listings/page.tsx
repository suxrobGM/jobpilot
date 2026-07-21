import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AdminListingsTable, AdminPagination, AdminSearchField } from "@/components/features/admin";
import { SectionCard } from "@/components/ui/layout";
import { pageParam } from "@/utils/search-params";

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: "Listings" };

interface AdminListingsPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

/** Moderation for the public job index. Unlike the catalog, this table is server-paginated. */
export default async function AdminListingsPage(
  props: AdminListingsPageProps,
): Promise<ReactElement> {
  const { page, q } = await props.searchParams;
  const currentPage = pageParam(page);

  const { data } = await api.admin.listings.get({
    query: { page: currentPage, limit: PAGE_SIZE, ...(q?.trim() && { q: q.trim() }) },
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <SectionCard
      title="Job listings"
      description="The public, deduped job index behind /jobs. Hiding a listing removes it from the public pages but keeps the row, so a re-scrape does not resurrect it."
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <AdminSearchField placeholder="Search title or company" />
      </Stack>

      <AdminListingsTable listings={data.items} />

      <AdminPagination
        page={data.pagination.page}
        pageCount={data.pagination.totalPages}
        pageSize={data.pagination.limit}
        total={data.pagination.total}
      />
    </SectionCard>
  );
}
