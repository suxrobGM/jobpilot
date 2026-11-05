"use client";

import type { ReactElement } from "react";
import { Refresh } from "@mui/icons-material";
import { Button } from "@mui/material";
import { recheckTerminalHealth } from "@/hooks/use-terminal-health";

export function RecheckButton(): ReactElement {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<Refresh />}
      onClick={recheckTerminalHealth}
      sx={{ alignSelf: "flex-start" }}
    >
      Recheck
    </Button>
  );
}
