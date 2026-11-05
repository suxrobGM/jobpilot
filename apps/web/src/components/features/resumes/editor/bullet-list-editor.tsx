"use client";

import type { ReactElement } from "react";
import { RESUME_BULLET_CHARS_PER_LINE } from "@jobpilot/contracts/resume";
import { Add, ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { Button, Stack, TextField } from "@mui/material";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { moveAt, removeAt, replaceAt } from "@/utils/array";

/** Past two rendered lines a bullet starts pushing the page layout around. */
const LONG_BULLET = RESUME_BULLET_CHARS_PER_LINE * 2;

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
            helperText={
              b.length > LONG_BULLET ? `${b.length} characters - runs past two lines` : undefined
            }
          />
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
          <TooltipIconButton title="Remove bullet" size="small" onClick={() => remove(i)}>
            <Delete fontSize="sm" />
          </TooltipIconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<Add />} onClick={add} sx={{ alignSelf: "flex-start" }}>
        Add bullet
      </Button>
    </Stack>
  );
}
