"use client";

import type { ReactElement } from "react";
import { MenuItem, TextField } from "@mui/material";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

interface SelectItem {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  items: ReadonlyArray<SelectItem>;
  optional?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}

/** TanStack Form-bound select — wires value/change/blur and validation errors to the field context. */
export function Select(props: SelectProps): ReactElement {
  const { label, items, optional, emptyLabel = "- none -", disabled } = props;
  const field = useFieldContext<string | number>();

  return (
    <TextField
      fullWidth
      select
      label={label}
      disabled={disabled}
      value={field.state.value ?? ""}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.length > 0}
      helperText={firstErrorMessage(field.state.meta.errors)}
    >
      {optional && (
        <MenuItem value="">
          <em>{emptyLabel}</em>
        </MenuItem>
      )}
      {items.map((it) => (
        <MenuItem key={it.value} value={it.value}>
          {it.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
