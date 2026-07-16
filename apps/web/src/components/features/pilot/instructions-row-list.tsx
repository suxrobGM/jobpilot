"use client";

import type { ReactElement, ReactNode } from "react";
import { Add, Delete } from "@mui/icons-material";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";

interface InstructionsRowListProps {
  count: number;
  /** Positional row keys from useKeyedList. */
  keys: readonly string[];
  emptyText: string;
  addLabel: string;
  removeAria: (index: number) => string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Renders one row's field cells. */
  children: (index: number) => ReactNode;
}

export function InstructionsRowList(props: InstructionsRowListProps): ReactElement {
  const { count, keys, emptyText, addLabel, removeAria, onAdd, onRemove, children } = props;

  return (
    <Stack spacing={2}>
      {Array.from({ length: count }, (_, i) => (
        <Stack key={keys[i]} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {children(i)}
          <IconButton
            aria-label={removeAria(i)}
            size="small"
            sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
            onClick={() => onRemove(i)}
          >
            <Delete fontSize="sm" />
          </IconButton>
        </Stack>
      ))}
      {count === 0 && <Typography variant="body2Muted">{emptyText}</Typography>}
      <Box>
        <Button variant="outlined" startIcon={<Add fontSize="sm" />} onClick={onAdd}>
          {addLabel}
        </Button>
      </Box>
    </Stack>
  );
}
