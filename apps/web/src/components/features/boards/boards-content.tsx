"use client";

import { type ReactElement, useState } from "react";
import { Clear, Delete } from "@mui/icons-material";
import {
  Button,
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
import { TooltipIconButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/data";
import { ExternalLink } from "@/components/ui/display";
import { SearchField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useConfirm } from "@/providers/confirm-provider";

const SEARCH_DEBOUNCE_MS = 200;

export function BoardsContent(): ReactElement {
  const [searchDraft, setSearchDraft] = useState("");

  const search = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS);
  const confirm = useConfirm();

  const boards = useApiQuery(jobBoardQueries.list());
  // Filtered here, not server-side: a profile's board list is bounded by the catalog.
  const needle = search.trim().toLowerCase();
  const rows = (boards.data ?? []).filter(
    (b) =>
      !needle || b.name.toLowerCase().includes(needle) || b.domain.toLowerCase().includes(needle),
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

  const handleResetFilters = (): void => setSearchDraft("");

  return (
    <SectionCard>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
      >
        <SearchField
          value={searchDraft}
          placeholder="Search name or domain"
          onChange={setSearchDraft}
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

      {rows.length === 0 ? (
        <EmptyState
          variant="inline"
          title={
            isAnyFilterActive
              ? "No boards match the current filters."
              : "No boards yet. Add one to let campaigns search it."
          }
        />
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell>Search URL</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                  <TableCell>{b.domain}</TableCell>
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
                    <TooltipIconButton title="Remove board" onClick={() => void handleDelete(b)}>
                      <Delete fontSize="sm" />
                    </TooltipIconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
  );
}
