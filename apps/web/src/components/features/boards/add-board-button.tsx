"use client";

import { type ReactElement, useState } from "react";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { BoardFormDialog } from "./board-form-dialog";
import { useLinkBoard } from "./use-link-board";

export function AddBoardButton(): ReactElement {
  const [open, setOpen] = useState(false);

  const create = useLinkBoard({
    successMessage: "Board added",
    onSuccess: () => setOpen(false),
  });

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
