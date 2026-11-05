"use client";

import type { ReactElement } from "react";
import { Refresh } from "@mui/icons-material";
import { Button } from "@mui/material";

/** "Recheck" action shared by the dock's install/offline cards - re-probes the local host. */
interface RecheckButtonProps {
  onClick: () => void;
}

export function RecheckButton(props: RecheckButtonProps): ReactElement {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<Refresh />}
      onClick={props.onClick}
      sx={{ alignSelf: "flex-start" }}
    >
      Recheck
    </Button>
  );
}
