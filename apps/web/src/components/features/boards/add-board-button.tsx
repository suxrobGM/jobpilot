"use client";

import { type ReactElement, useState } from "react";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { AddBoardDialog } from "./add-board-dialog";
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
      <AddBoardDialog
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(values) => create.mutate(values)}
        submitting={create.isPending}
      />
    </>
  );
}
