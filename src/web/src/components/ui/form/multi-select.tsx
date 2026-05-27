"use client";

import type { ReactElement } from "react";
import { Autocomplete, TextField } from "@mui/material";

export interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  options?: ReadonlyArray<string>;
  freeSolo?: boolean;
  label?: string;
  placeholder?: string;
  errorText?: string;
}

/**
 * Themed multi-value autocomplete that renders chips for the selected strings.
 * Presentational and controlled — defaults to free-solo so users can add
 * arbitrary entries.
 */
export function MultiSelect(props: MultiSelectProps): ReactElement {
  const {
    value,
    onChange,
    onBlur,
    options = [],
    freeSolo = true,
    label,
    placeholder,
    errorText,
  } = props;

  return (
    <Autocomplete
      multiple
      freeSolo={freeSolo}
      options={[...options]}
      value={value}
      onChange={(_, v) => onChange(v)}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={Boolean(errorText)}
          helperText={errorText}
        />
      )}
    />
  );
}
