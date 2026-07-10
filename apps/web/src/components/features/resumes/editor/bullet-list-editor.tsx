"use client";

import type { ReactElement } from "react";
import { Add, ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { Button, IconButton, Stack, TextField } from "@mui/material";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { moveAt, removeAt, replaceAt } from "@/utils/array";

interface BulletListEditorProps {
  label?: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
}

export function BulletListEditor(props: BulletListEditorProps): ReactElement {
  const { value, onChange, placeholder, label } = props;
  const { keys, onMove, onRemove, onAdd } = useKeyedList(value.length);

  const update = (idx: number, text: string) => onChange(replaceAt(value, idx, text));
  const remove = (idx: number) => {
    onRemove(idx);
    onChange(removeAt(value, idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    onMove(idx, dir);
    onChange(moveAt(value, idx, dir));
  };
  const add = () => {
    onAdd();
    onChange([...value, ""]);
  };

  return (
    <Stack spacing={1}>
      {value.map((b, i) => (
        <Stack key={keys[i]} direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={1}
            label={label && i === 0 ? label : undefined}
            placeholder={placeholder}
            value={b}
            onChange={(e) => update(i, e.target.value)}
          />
          <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0}>
            <ArrowUpward fontSize="sm" />
          </IconButton>
          <IconButton size="small" onClick={() => move(i, 1)} disabled={i === value.length - 1}>
            <ArrowDownward fontSize="sm" />
          </IconButton>
          <IconButton size="small" onClick={() => remove(i)} aria-label="Remove bullet">
            <Delete fontSize="sm" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<Add />} onClick={add} sx={{ alignSelf: "flex-start" }}>
        Add bullet
      </Button>
    </Stack>
  );
}
