"use client";

import type { ReactElement } from "react";
import { Search } from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** The search box that leads a list's toolbar; full width on phones. */
export function SearchField(props: SearchFieldProps): ReactElement {
  const { value, onChange, placeholder } = props;

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="sm" />
            </InputAdornment>
          ),
        },
      }}
      sx={{ width: { xs: "100%", sm: 300 } }}
    />
  );
}
