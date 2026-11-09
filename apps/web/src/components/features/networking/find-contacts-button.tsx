"use client";

import { type ReactElement, useState } from "react";
import { PersonSearch } from "@mui/icons-material";
import { Button } from "@mui/material";
import { FindContactsDialog } from "./find-contacts-dialog";

/** The Outreach page's top-bar action, shared by both tabs. */
export function FindContactsButton(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="contained"
        startIcon={<PersonSearch fontSize="sm" />}
        onClick={() => setOpen(true)}
      >
        Find contacts
      </Button>
      <FindContactsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
