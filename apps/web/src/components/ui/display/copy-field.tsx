"use client";

import type { ReactElement } from "react";
import { ContentCopy } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { useCopy } from "@/hooks/use-copy";

interface CopyFieldProps {
  value: string;
  copyMessage?: string;
  ariaLabel?: string;
}

/** Monospace value box with a copy-to-clipboard button (redirect URIs, install commands, …). */
export function CopyField(props: CopyFieldProps): ReactElement {
  const { value, copyMessage = "Copied", ariaLabel = "Copy" } = props;
  const copy = useCopy();

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box
        sx={(theme) => ({
          flex: 1,
          minWidth: 0,
          px: 1.5,
          py: 1,
          borderRadius: theme.radii.xs,
          bgcolor: "action.hover",
          ...theme.typography.monoBody,
          overflowX: "auto",
          whiteSpace: "nowrap",
        })}
      >
        {value}
      </Box>
      <Tooltip title="Copy">
        <IconButton onClick={() => void copy(value, copyMessage)} aria-label={ariaLabel}>
          <ContentCopy fontSize="sm" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
