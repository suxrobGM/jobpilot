"use client";

import type { ReactElement, ReactNode } from "react";
import { Add, Delete } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { RowCard } from "./row-card";

interface FieldRowListProps {
  count: number;
  /** Positional row keys from useKeyedList. */
  keys: readonly string[];
  emptyText?: string;
  addLabel: string;
  /** Heading shown atop each row, e.g. "Search 1"; also names the remove button. */
  rowLabel: (index: number) => string;
  /** Hides the add button once the list holds this many rows. */
  max?: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Renders one row's field cells. */
  children: (index: number) => ReactNode;
}

/** A form array's rows by index; pair with `form.AppField mode="array"`. */
export function FieldRowList(props: FieldRowListProps): ReactElement {
  const { count, keys, emptyText, addLabel, rowLabel, max, onAdd, onRemove, children } = props;
  const canAdd = max === undefined || count < max;

  return (
    <Stack spacing={2}>
      {Array.from({ length: count }, (_, i) => (
        <RowCard
          key={keys[i]}
          title={rowLabel(i)}
          actions={
            <TooltipIconButton
              title={`Remove ${rowLabel(i)}`}
              size="small"
              onClick={() => onRemove(i)}
            >
              <Delete fontSize="sm" />
            </TooltipIconButton>
          }
        >
          <Stack spacing={2}>{children(i)}</Stack>
        </RowCard>
      ))}
      {count === 0 && emptyText && <Typography variant="body2Muted">{emptyText}</Typography>}
      {canAdd && (
        <Box>
          <Button variant="outlined" startIcon={<Add fontSize="sm" />} onClick={onAdd}>
            {addLabel}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
