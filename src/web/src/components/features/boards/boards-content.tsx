"use client";

import { useState, type ReactElement } from "react";
import { Clear, Delete, Edit, Person, Search } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiClient } from "@/api/client";
import type { JobBoardPatch } from "@/api/contracts/job-board";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { JobBoardDto } from "@/api/types";
import { PaginationFooter } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { SectionCard } from "@/components/ui/layout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagination } from "@/hooks/use-pagination";
import { BoardFormDialog } from "./board-form-dialog";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 200;

export function BoardsContent(): ReactElement {
  const [editing, setEditing] = useState<JobBoardDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JobBoardDto | null>(null);
  const [searchDraft, setSearchDraft] = useState("");

  const search = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS);

  const boards = useApiQuery<JobBoardDto[]>(queryKeys.jobBoards.list(), () =>
    apiClient.get<JobBoardDto[]>("/api/job-boards"),
  );

  const update = useApiMutation<JobBoardDto, { id: number; patch: JobBoardPatch }>(
    ({ id, patch }) => apiClient.patch<JobBoardDto>(`/api/job-boards/${id}`, patch),
    {
      successMessage: "Board updated",
      invalidate: [queryKeys.jobBoards.all],
      onSuccess: () => setEditing(null),
    },
  );

  const remove = useApiMutation<{ deleted: number }, number>(
    (id) => apiClient.del<{ deleted: number }>(`/api/job-boards/${id}`),
    {
      successMessage: "Board removed",
      invalidate: [queryKeys.jobBoards.all],
      onSuccess: () => setPendingDelete(null),
    },
  );

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
          <TextField
            size="small"
            placeholder="Search name or domain"
            value={searchDraft}
            onChange={(e) => {
              setSearchDraft(e.target.value);
              setPage(1);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="sm" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1, minWidth: 200 }}
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
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography variant="body2Muted">
              No boards yet. Campaign <code>bun db:setup</code> to seed defaults.
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography variant="body2Muted">No boards match the current filters.</Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {pageRows.map((b) => (
              <Card key={b.id}>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {b.name}
                      </Typography>
                      <Typography variant="captionMuted">{b.domain}</Typography>
                      {b.email && (
                        <Typography
                          variant="captionMuted"
                          sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}
                        >
                          <Person fontSize="sm" />
                          {b.email}
                        </Typography>
                      )}
                    </Box>
                    <IconButton onClick={() => setEditing(b)} aria-label="Edit board">
                      <Edit fontSize="md" />
                    </IconButton>
                    <IconButton onClick={() => setPendingDelete(b)} aria-label="Delete board">
                      <Delete fontSize="md" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
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
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete board?"
        description={
          pendingDelete
            ? `Remove "${pendingDelete.name}"? Skills won't search this board until you add it back.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
