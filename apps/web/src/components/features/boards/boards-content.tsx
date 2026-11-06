"use client";

import { type ReactElement, useState } from "react";
import { Delete } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { jobBoardQueries } from "@/api/queries";
import type { JobBoardDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { type SimpleColumn, SimpleTable } from "@/components/ui/data/simple-table";
import { ExternalLink } from "@/components/ui/display";
import { FilterBar, SearchField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";

export function BoardsContent(): ReactElement {
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  const boards = useQuery(jobBoardQueries.list());
  // Filtered here, not server-side: a profile's board list is bounded by the catalog.
  const needle = search.trim().toLowerCase();
  const rows = (boards.data ?? []).filter(
    (b) =>
      !needle || b.name.toLowerCase().includes(needle) || b.domain.toLowerCase().includes(needle),
  );

  const remove = useApiMutation((id: string) => api["job-boards"]({ id }).delete(), {
    successMessage: "Board removed",
    invalidate: [jobBoardQueries.all],
  });

  const handleDelete = async (board: JobBoardDto): Promise<void> => {
    const confirmed = await confirm({
      title: "Remove board?",
      description: `Remove "${board.name}"? Skills won't search this board until you add it back. Any saved login for ${board.domain} stays in Credentials.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(board.id);
    }
  };

  const isAnyFilterActive = needle.length > 0;

  const columns: SimpleColumn<JobBoardDto>[] = [
    { key: "name", header: "Name", render: (board) => board.name },
    { key: "domain", header: "Domain", render: (board) => board.domain },
    {
      key: "searchUrl",
      header: "Search URL",
      render: (board) =>
        board.searchUrl && (
          <ExternalLink href={board.searchUrl} truncateTo={280}>
            {board.searchUrl}
          </ExternalLink>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      nowrap: true,
      render: (board) => (
        <TooltipIconButton title="Remove board" onClick={() => void handleDelete(board)}>
          <Delete fontSize="sm" />
        </TooltipIconButton>
      ),
    },
  ];

  return (
    <SectionCard>
      <FilterBar hasFilters={isAnyFilterActive} onClear={() => setSearch("")}>
        <SearchField value={search} placeholder="Search name or domain" onChange={setSearch} />
      </FilterBar>

      <SimpleTable
        columns={columns}
        rows={rows}
        rowKey={(board) => board.id}
        emptyTitle={
          isAnyFilterActive
            ? "No boards match the current filters."
            : "No boards yet. Add one for the pilot to search."
        }
      />
    </SectionCard>
  );
}
