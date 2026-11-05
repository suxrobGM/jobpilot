"use client";

import type { ReactElement } from "react";
import { Autocomplete, TextField } from "@mui/material";

interface TagInputProps {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
}

/** Chips, not one comma-joined string: a controlled split-on-comma field eats the comma as you type it. */
export function TagInput(props: TagInputProps): ReactElement {
  const { label, placeholder, value, onChange } = props;
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, items) => onChange(items.map((item) => item.trim()).filter(Boolean))}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}
