import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AdminPagination, AdminPilotsTable } from "@/components/features/admin";
import { SectionCard } from "@/components/ui/layout";
import { pageParam } from "@/utils/search-params";

const PAGE_SIZE = 20;

interface AdminPilotsPageProps {
  searchParams: Promise<{ page?: string }>;
}

/** `?page=` drives the server fetch; the query schema has no search field. */
export default async function AdminPilotsPage(props: AdminPilotsPageProps): Promise<ReactElement> {
  const { page } = await props.searchParams;
  const currentPage = pageParam(page);

  const { data } = await api.admin.pilots.get({
    query: { page: currentPage, limit: PAGE_SIZE },
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <SectionCard
      title="Pilot fleet"
      description="Every user's autonomous Pilot: enablement, cycle activity, and open questions."
    >
      <AdminPilotsTable pilots={data.items} />

      <AdminPagination
        page={data.pagination.page}
        pageCount={data.pagination.totalPages}
        pageSize={data.pagination.limit}
        total={data.pagination.total}
      />
    </SectionCard>
  );
}
