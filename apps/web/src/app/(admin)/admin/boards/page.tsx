import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import {
  AddBoardButton,
  AdminBoardsTable,
  AdminPagination,
  AdminSearchField,
} from "@/components/features/admin";
import { SectionCard } from "@/components/ui/layout";
import { pageParam } from "@/utils/search-params";

const PAGE_SIZE = 10;

export const metadata: Metadata = { title: "Boards" };

interface AdminBoardsPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

/** The catalog is small, so `?q=` / `?page=` are applied here rather than as a filtered endpoint. */
export default async function AdminBoardsPage(props: AdminBoardsPageProps): Promise<ReactElement> {
  const { page, q } = await props.searchParams;
  const currentPage = pageParam(page);

  const { data } = await api.admin.boards.get(await getFetchOptions());

  if (!data) {
    notFound();
  }

  const needle = (q ?? "").trim().toLowerCase();
  const matches = data.filter(
    (board) =>
      !needle ||
      board.name.toLowerCase().includes(needle) ||
      board.domain.toLowerCase().includes(needle),
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const boards = matches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <SectionCard
      title="Board catalog"
      description="The single source of every board. Listed boards are offered to all users; default boards are added to new accounts."
      actions={<AddBoardButton />}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <AdminSearchField placeholder="Search name or domain" />
      </Stack>

      <AdminBoardsTable boards={boards} />

      <AdminPagination
        page={safePage}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        total={matches.length}
      />
    </SectionCard>
  );
}
