"use client";

import { MenuItem, TextField } from "@mui/material";
import type { ReactElement } from "react";

export interface SelectFilterOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

interface SelectFilterProps<TValue extends string = string> {
  label: string;
  value: TValue | undefined;
  options: ReadonlyArray<SelectFilterOption<TValue>>;
  /** Label shown for the empty / "all" sentinel. Defaults to "All". */
  emptyLabel?: string;
  minWidth?: number;
  onChange: (value: TValue | undefined) => void;
}

/**
 * Compact non-form-bound select used inside a FilterBar. Empty value
 * means "no filter" — selecting the empty option calls onChange(undefined).
 */
export function SelectFilter<TValue extends string = string>(
  props: SelectFilterProps<TValue>,
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
        onChange(next ? (next as TValue) : undefined);
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
