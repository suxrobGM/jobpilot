"use client";

import type { ReactElement } from "react";
import { ContentCopy } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { useToast } from "@/providers/notification-provider";

interface CopyFieldProps {
  value: string;
  copyMessage?: string;
  ariaLabel?: string;
}

/** Monospace value box with a copy-to-clipboard button (redirect URIs, install commands, …). */
export function CopyField(props: CopyFieldProps): ReactElement {
  const { value, copyMessage = "Copied", ariaLabel = "Copy" } = props;
  const toast = useToast();

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(value);
    toast.success(copyMessage);
  };

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
          fontFamily: "monospace",
          fontSize: 13,
          overflowX: "auto",
          whiteSpace: "nowrap",
        })}
      >
        {value}
      </Box>
      <Tooltip title="Copy">
        <IconButton onClick={() => void copy()} aria-label={ariaLabel}>
          <ContentCopy fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
