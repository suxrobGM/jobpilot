"use client";

import { useState, type ReactElement } from "react";
import { Add, Delete, Edit } from "@mui/icons-material";
import { Box, Button, Chip, Container, IconButton, Stack, Switch, Typography } from "@mui/material";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { PageHeader } from "@/components/ui/layout/page-header";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { JobBoardInput, JobBoardPatch } from "@/lib/schemas/job-board";
import type { JobBoardDto } from "@/types/api";
import { BoardFormDialog } from "./board-form-dialog";

export function BoardsPageClient(): ReactElement {
  const [editing, setEditing] = useState<JobBoardDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JobBoardDto | null>(null);

  const boards = useApiQuery<JobBoardDto[]>(queryKeys.jobBoards.list(), () =>
    apiClient.get<JobBoardDto[]>("/api/job-boards"),
  );

  const create = useApiMutation<JobBoardDto, JobBoardInput>(
    (vars) => apiClient.post<JobBoardDto>("/api/job-boards", vars),
    {
      successMessage: "Board added",
      invalidate: [queryKeys.jobBoards.all],
      onSuccess: () => setCreating(false),
    },
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

  const rows = boards.data ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Configure"
          title="Job boards"
          description="Sites the search and apply skills will use. Add custom boards or disable ones you don't use."
          actions={
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>
              Add board
            </Button>
          }
        />
        <SectionCard>
          {rows.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography variant="body2Muted">
                No boards yet. Run <code>bun db:seed</code> to seed defaults.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {rows.map((b) => (
                <Stack
                  key={b.id}
                  direction="row"
                  spacing={2}
                  sx={(t) => ({
                    alignItems: "center",
                    p: 1.5,
                    borderRadius: t.radii.sm,
                    border: `1px solid ${t.palette.line.divider}`,
                    opacity: b.enabled ? 1 : 0.55,
                  })}
                >
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {b.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={b.type}
                        color={b.type === "ats" ? "primary" : "default"}
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="captionMuted">{b.domain}</Typography>
                  </Box>
                  <Switch
                    checked={b.enabled}
                    onChange={(e) =>
                      update.mutate({ id: b.id, patch: { enabled: e.target.checked } })
                    }
                  />
                  <IconButton onClick={() => setEditing(b)} aria-label="Edit board">
                    <Edit fontSize="md" />
                  </IconButton>
                  <IconButton onClick={() => setPendingDelete(b)} aria-label="Delete board">
                    <Delete fontSize="md" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>

      <BoardFormDialog
        open={creating}
        title="Add job board"
        onClose={() => setCreating(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
      <BoardFormDialog
        open={editing !== null}
        initial={
          editing
            ? {
                name: editing.name,
                domain: editing.domain,
                searchUrl: editing.searchUrl ?? "",
                type: editing.type,
                enabled: editing.enabled,
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
        message={
          pendingDelete
            ? `Remove "${pendingDelete.name}"? Skills won't search this board until you add it back.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </Container>
  );
}
