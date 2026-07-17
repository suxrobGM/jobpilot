"use client";

import type { ReactElement, ReactNode } from "react";
import { Add, Delete } from "@mui/icons-material";
import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";

interface InstructionsRowListProps {
  count: number;
  /** Positional row keys from useKeyedList. */
  keys: readonly string[];
  emptyText: string;
  addLabel: string;
  removeAria: (index: number) => string;
  /** Heading shown atop each row group, e.g. "Search 1". */
  rowLabel: (index: number) => string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Renders one row's field cells. */
  children: (index: number) => ReactNode;
}

export function InstructionsRowList(props: InstructionsRowListProps): ReactElement {
  const { count, keys, emptyText, addLabel, removeAria, rowLabel, onAdd, onRemove, children } =
    props;

  return (
    <Stack spacing={2}>
      {Array.from({ length: count }, (_, i) => (
        <Paper key={keys[i]} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="overlineMuted">{rowLabel(i)}</Typography>
              <IconButton aria-label={removeAria(i)} size="small" onClick={() => onRemove(i)}>
                <Delete fontSize="sm" />
              </IconButton>
            </Stack>
            {children(i)}
          </Stack>
        </Paper>
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
