"use client";

import type { ReactElement } from "react";
import { MenuItem, TextField } from "@mui/material";

export interface SelectFieldOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

interface SelectFieldProps<TValue extends string = string> {
  label: string;
  value: TValue | null;
  options: ReadonlyArray<SelectFieldOption<TValue>>;
  /** Defaults to "All". */
  emptyLabel?: string;
  minWidth?: number;
  onChange: (value: TValue | null) => void;
}

/** The empty option means "no filter" and calls onChange(null). */
export function SelectField<TValue extends string = string>(
  props: SelectFieldProps<TValue>,
): ReactElement {
  const { label, value, options, emptyLabel = "All", minWidth = 160, onChange } = props;
  return (
    <TextField
      size="small"
      select
      label={label}
      value={value ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next ? (next as TValue) : null);
      }}
      sx={{ minWidth }}
    >
      <MenuItem value="">
        <em>{emptyLabel}</em>
      </MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
