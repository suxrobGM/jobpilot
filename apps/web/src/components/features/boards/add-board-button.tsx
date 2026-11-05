"use client";

import { type ReactElement, useState } from "react";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { AddBoardDialog } from "./add-board-dialog";

export function AddBoardButton(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
        Add board
      </Button>
      <AddBoardDialog key={open ? "open" : "closed"} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
