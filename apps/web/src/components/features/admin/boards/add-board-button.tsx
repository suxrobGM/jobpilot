"use client";

import { type ReactElement, useState } from "react";
import type { AdminBoardInput } from "@jobpilot/contracts/job-board";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { AdminBoardDto } from "@/api/types";
import { AdminBoardFormDialog } from "./board-form-dialog";

/** Adds a board to the global catalog. Remounted by `key` so the dialog resets between opens. */
export function AddBoardButton(): ReactElement {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const create = useApiMutation<AdminBoardDto, AdminBoardInput>(
    (values) => api.admin.boards.post(values),
    {
      successMessage: "Board added to the catalog",
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    },
  );

  return (
    <>
      <Button size="small" startIcon={<Add fontSize="sm" />} onClick={() => setOpen(true)}>
        Add board
      </Button>
      <AdminBoardFormDialog
        key={open ? "open" : "closed"}
        open={open}
        title="Add catalog board"
        onClose={() => setOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </>
  );
}
