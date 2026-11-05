"use client";

import type { ReactElement } from "react";
import { TextField } from "@mui/material";
import Grid from "@mui/material/Grid";

/** The keys of `T` whose values are text, so a typo'd or numeric field is a compile error. */
type TextKeys<T> = {
  [K in keyof T]: T[K] extends string | null | undefined ? K : never;
}[keyof T];

interface EntryTextFieldProps<T> {
  entry: T;
  field: TextKeys<T>;
  label: string;
  onUpdate: (next: T) => void;
  /** Grid columns from `sm` up; a quarter-width field (dates) stays half-width on phones. */
  width?: number;
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
  minRows?: number;
}

/** One text field of a resume entry, in its grid cell. */
export function EntryTextField<T>(props: EntryTextFieldProps<T>): ReactElement {
  const {
    entry,
    field,
    label,
    onUpdate,
    width = 6,
    placeholder,
    helperText,
    multiline,
    minRows,
  } = props;
  const value = entry[field] as string | null | undefined;
  return (
    <Grid size={{ xs: width === 3 ? 6 : 12, sm: width }}>
      <TextField
        fullWidth
        label={label}
        placeholder={placeholder}
        helperText={helperText}
        multiline={multiline}
        minRows={minRows}
        value={value ?? ""}
        onChange={(e) => onUpdate({ ...entry, [field]: e.target.value })}
      />
    </Grid>
  );
}
