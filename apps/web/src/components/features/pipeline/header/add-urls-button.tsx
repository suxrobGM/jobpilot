"use client";

import type { ReactElement } from "react";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/material";
import { usePipelineActions } from "../actions-provider";

export function AddUrlsButton(): ReactElement {
  const { openAddUrls } = usePipelineActions();
  return (
    <Button variant="outlined" size="small" startIcon={<Add fontSize="md" />} onClick={openAddUrls}>
      Add URLs
    </Button>
  );
}
