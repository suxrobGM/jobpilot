"use client";

import { useState, type ReactElement } from "react";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { apiClient } from "@/api/client";
import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { JobBoardDto } from "@/api/types";
import { BoardFormDialog } from "./board-form-dialog";

export function AddBoardButton(): ReactElement {
  const [open, setOpen] = useState(false);

  const create = useApiMutation<JobBoardDto, JobBoardInput>(
    (vars) => apiClient.post<JobBoardDto>("/api/job-boards", vars),
    {
      successMessage: "Board added",
      invalidate: [queryKeys.jobBoards.all],
      onSuccess: () => setOpen(false),
    },
  );

  return (
    <>
      <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
        Add board
      </Button>
      <BoardFormDialog
        key={open ? "open" : "closed"}
        open={open}
        title="Add job board"
        onClose={() => setOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </>
  );
}
