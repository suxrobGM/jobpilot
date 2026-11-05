"use client";

import type { ReactElement, ReactNode } from "react";
import { Add, ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { RowCard } from "@/components/ui/form/row-card";
import { moveAt, removeAt, replaceAt } from "@/utils/array";

interface EntryListProps<T extends { id?: string }> {
  value: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  renderEntry: (entry: T, onUpdate: (next: T) => void) => ReactNode;
  renderTitle: (entry: T, index: number) => string;
  addLabel: string;
  emptyLabel?: string;
}

export function EntryList<T extends { id?: string }>(props: EntryListProps<T>): ReactElement {
  const { value, onChange, newItem, renderEntry, renderTitle, addLabel, emptyLabel } = props;

  const update = (idx: number, next: T) => onChange(replaceAt(value, idx, next));
  const remove = (idx: number) => onChange(removeAt(value, idx));
  const move = (idx: number, dir: -1 | 1) => onChange(moveAt(value, idx, dir));

  return (
    <Stack spacing={1.5}>
      {value.length === 0 && emptyLabel && (
        <Typography variant="body2Muted">{emptyLabel}</Typography>
      )}
      {value.map((entry, i) => (
        <RowCard
          key={entry.id}
          title={renderTitle(entry, i)}
          actions={
            <Stack direction="row" spacing={0.5}>
              <TooltipIconButton
                title="Move up"
                size="small"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ArrowUpward fontSize="sm" />
              </TooltipIconButton>
              <TooltipIconButton
                title="Move down"
                size="small"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
              >
                <ArrowDownward fontSize="sm" />
              </TooltipIconButton>
              <TooltipIconButton title="Remove" size="small" onClick={() => remove(i)}>
                <Delete fontSize="sm" />
              </TooltipIconButton>
            </Stack>
          }
        >
          {renderEntry(entry, (next) => update(i, next))}
        </RowCard>
      ))}
      <Button
        startIcon={<Add />}
        onClick={() => onChange([...value, newItem()])}
        sx={{ alignSelf: "flex-start" }}
      >
        {addLabel}
      </Button>
    </Stack>
  );
}
