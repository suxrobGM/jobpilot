import { type ReactElement, Suspense } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { AddBoardButton, AdminBoardsTable, AdminSearchField } from "@/components/features/admin";
import { PaginationControls, TableSkeleton } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { type PaginationSearchParams, paginationQuery } from "@/utils/search-params";

export const metadata: Metadata = { title: "Boards" };

interface AdminBoardsPageProps {
  searchParams: Promise<PaginationSearchParams & { q?: string }>;
}

/** `?q=` / `?page=` drive the server fetch; only the search box and pager are client. */
export default function AdminBoardsPage(props: AdminBoardsPageProps): ReactElement {
  const { searchParams } = props;

  return (
    <SectionCard
      title="Board catalog"
      description="The single source of every board. Listed boards are offered to all users; default boards are added to new accounts."
      actions={<AddBoardButton />}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <AdminSearchField placeholder="Search name or domain" />
      </Stack>

      <Suspense fallback={<TableSkeleton />}>
        <AdminBoards searchParams={searchParams} />
      </Suspense>
    </SectionCard>
  );
}

async function AdminBoards(props: AdminBoardsPageProps): Promise<ReactElement> {
  const search = await props.searchParams;

  const { data } = await api.admin.boards.get({
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
      <AdminBoardsTable boards={data.items} />
      <PaginationControls pagination={data.pagination} />
    </>
  );
}
