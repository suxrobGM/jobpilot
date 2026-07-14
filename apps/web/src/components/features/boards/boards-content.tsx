"use client";

import { type ReactElement, useState } from "react";
import type { JobBoardPatch } from "@jobpilot/contracts/job-board";
import { Clear, Delete, Edit, MoreVert } from "@mui/icons-material";
import {
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { JobBoardDto } from "@/api/types";
import { EmptyState, PaginationFooter } from "@/components/ui/data";
import { ExternalLink } from "@/components/ui/display";
import { DropdownMenu } from "@/components/ui/feedback";
import { SearchField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagination } from "@/hooks/use-pagination";
import { useConfirm } from "@/providers/confirm-provider";
import { BoardFormDialog } from "./board-form-dialog";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 200;

export function BoardsContent(): ReactElement {
  const [editing, setEditing] = useState<JobBoardDto | null>(null);
  const [searchDraft, setSearchDraft] = useState("");

  const search = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS);
  const confirm = useConfirm();

  const boards = useApiQuery(jobBoardQueries.list());

  const update = useApiMutation<JobBoardDto, { id: string; patch: JobBoardPatch }>(
    ({ id, patch }) => api["job-boards"]({ id }).patch(patch),
    {
      successMessage: "Board updated",
      invalidate: [queryKeys.jobBoards.all],
      onSuccess: () => setEditing(null),
    },
  );

  const remove = useApiMutation<{ deleted: string }, string>(
    (id) => api["job-boards"]({ id }).delete(),
    {
      successMessage: "Board removed",
      invalidate: [queryKeys.jobBoards.all],
    },
  );

  const handleDelete = async (board: JobBoardDto): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete board?",
      description: `Remove "${board.name}"? Skills won't search this board until you add it back.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(board.id);
    }
  };

  const allRows = boards.data ?? [];
  const needle = search.trim().toLowerCase();

  const filteredRows = allRows.filter((b) => {
    if (
      needle &&
      !b.name.toLowerCase().includes(needle) &&
      !b.domain.toLowerCase().includes(needle)
    ) {
      return false;
    }

    return true;
  });

  const isAnyFilterActive = needle.length > 0;
  const { page, setPage, pageCount, pageRows, total } = usePagination(filteredRows, PAGE_SIZE);

  const handleResetFilters = (): void => {
    setSearchDraft("");
    setPage(1);
  };

  return (
    <>
      <SectionCard>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
        >
          <SearchField
            value={searchDraft}
            placeholder="Search name or domain"
            onChange={(value) => {
              setSearchDraft(value);
              setPage(1);
            }}
          />
          {isAnyFilterActive && (
            <Button
              size="small"
              variant="text"
              startIcon={<Clear fontSize="sm" />}
              onClick={handleResetFilters}
            >
              Clear
            </Button>
          )}
        </Stack>

        {allRows.length === 0 ? (
          <EmptyState variant="inline" title="No boards yet. Add one to let campaigns search it." />
        ) : filteredRows.length === 0 ? (
          <EmptyState variant="inline" title="No boards match the current filters." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Search URL</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                    <TableCell>{b.domain}</TableCell>
                    <TableCell>
                      {b.email ?? <Typography variant="captionMuted">-</Typography>}
                    </TableCell>
                    <TableCell>
                      {b.searchUrl ? (
                        <ExternalLink href={b.searchUrl} truncateTo={280}>
                          {b.searchUrl}
                        </ExternalLink>
                      ) : (
                        <Typography variant="captionMuted">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <DropdownMenu
                        trigger={({ onOpen }) => (
                          <IconButton onClick={onOpen} aria-label="Board actions">
                            <MoreVert fontSize="md" />
                          </IconButton>
                        )}
                        items={[
                          {
                            kind: "item",
                            key: "edit",
                            label: "Edit",
                            icon: <Edit fontSize="sm" />,
                            onClick: () => setEditing(b),
                          },
                          {
                            kind: "item",
                            key: "delete",
                            label: "Delete",
                            icon: <Delete fontSize="sm" />,
                            danger: true,
                            onClick: () => void handleDelete(b),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <PaginationFooter
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={total}
          onChange={setPage}
        />
      </SectionCard>

      <BoardFormDialog
        key={editing?.id ?? "new"}
        open={editing !== null}
        initial={
          editing
            ? {
                name: editing.name,
                domain: editing.domain,
                searchUrl: editing.searchUrl ?? "",
                email: editing.email ?? "",
                password: editing.password ?? "",
                sortOrder: editing.sortOrder,
              }
            : null
        }
        title="Edit job board"
        onClose={() => setEditing(null)}
        onSubmit={(values) => editing && update.mutate({ id: editing.id, patch: values })}
        submitting={update.isPending}
      />
    </>
  );
}
