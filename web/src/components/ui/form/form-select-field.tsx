"use client";

import { MenuItem, TextField } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactElement } from "react";
import type { AnyReactForm } from "./types";

interface SelectItem {
  value: string | number;
  label: string;
}

interface FormSelectFieldProps {
  form: AnyReactForm;
  name: string;
  label?: string;
  items: ReadonlyArray<SelectItem>;
  optional?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}

export function FormSelectField(props: FormSelectFieldProps): ReactElement {
  const { form, name, label, items, optional, emptyLabel = "- none -", disabled } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <TextField
          fullWidth
          select
          label={label}
          disabled={disabled}
          value={field.state.value ?? ""}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          error={field.state.meta.errors.length > 0}
          helperText={
            (field.state.meta.errors[0] as { message?: string } | undefined)?.message
          }
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
      )}
    </form.Field>
  );
}
