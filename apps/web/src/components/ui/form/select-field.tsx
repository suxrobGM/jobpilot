"use client";

import type { ReactElement } from "react";
import { InputAdornment, MenuItem, TextField } from "@mui/material";

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
  disabled?: boolean;
  onChange: (value: TValue | null) => void;
}

/** A compact filter: the label sits inside the box ("Board All"). The empty option calls onChange(null). */
export function SelectField<TValue extends string = string>(
  props: SelectFieldProps<TValue>,
): ReactElement {
  const { label, value, options, emptyLabel = "All", disabled, onChange } = props;
  return (
    <TextField
      size="small"
      select
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next ? (next as TValue) : null);
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ color: "text.secondary" }}>
              {label}
            </InputAdornment>
          ),
        },
        select: {
          displayEmpty: true,
          renderValue: (selected) =>
            options.find((option) => option.value === selected)?.label ?? emptyLabel,
          SelectDisplayProps: { "aria-label": label },
        },
      }}
      sx={{ flexShrink: 0 }}
    >
      <MenuItem value="">{emptyLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
