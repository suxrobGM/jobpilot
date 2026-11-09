"use client";

import type { ReactElement } from "react";
import { ListItemText, MenuItem, TextField } from "@mui/material";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

interface SelectItem {
  value: string | number;
  label: string;
  /** Shown under the label in the open menu only. */
  description?: string;
}

interface SelectProps {
  label?: string;
  items: ReadonlyArray<SelectItem>;
  optional?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  /** Guidance shown below the field when there is no validation error. */
  helperText?: string;
}

export function Select(props: SelectProps): ReactElement {
  const { label, items, optional, emptyLabel = "- none -", disabled, helperText } = props;
  const field = useFieldContext<string | number>();
  const labelOf = (value: unknown) => items.find((it) => it.value === value)?.label ?? emptyLabel;

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
      helperText={firstErrorMessage(field.state.meta.errors) ?? helperText}
      slotProps={{ select: { renderValue: labelOf } }}
    >
      {optional && (
        <MenuItem value="">
          <em>{emptyLabel}</em>
        </MenuItem>
      )}
      {items.map((it) => (
        <MenuItem key={it.value} value={it.value}>
          {it.description && <ListItemText primary={it.label} secondary={it.description} />}
          {!it.description && it.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
