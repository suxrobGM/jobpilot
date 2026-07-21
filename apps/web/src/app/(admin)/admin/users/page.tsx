import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AdminPagination, AdminSearchField, AdminUsersTable } from "@/components/features/admin";
import { SectionCard } from "@/components/ui/layout";
import { pageParam } from "@/utils/search-params";

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: "Users" };

interface AdminUsersPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

/** `?q=` / `?page=` drive the server fetch; only the search box, pager, and role menu are client. */
export default async function AdminUsersPage(props: AdminUsersPageProps): Promise<ReactElement> {
  const { page, q } = await props.searchParams;
  const currentPage = pageParam(page);

  const { data } = await api.admin.users.get({
    query: { page: currentPage, limit: PAGE_SIZE, search: q || undefined },
    ...(await getFetchOptions()),
  });

  if (!data) {
    notFound();
  }

  return (
    <SectionCard>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <AdminSearchField placeholder="Search by email" />
      </Stack>

      <AdminUsersTable users={data.items} />

      <AdminPagination
        page={data.pagination.page}
        pageCount={data.pagination.totalPages}
        pageSize={data.pagination.limit}
        total={data.pagination.total}
      />
    </SectionCard>
  );
}
