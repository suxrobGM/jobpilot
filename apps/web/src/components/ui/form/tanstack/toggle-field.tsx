"use client";

import type { ReactElement } from "react";
import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useFieldContext } from "./form-context";

interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleProps {
  label?: string;
  options: ReadonlyArray<ToggleOption>;
  exclusive?: boolean;
}

/** Exclusive groups hold one string; `exclusive={false}` holds a string array. */
export function Toggle(props: ToggleProps): ReactElement {
  const { label, options, exclusive = true } = props;
  const field = useFieldContext<string | string[]>();

  return (
    <Stack spacing={0.5}>
      {label && <Typography variant="body2Muted">{label}</Typography>}
      <ToggleButtonGroup
        size="small"
        exclusive={exclusive}
        value={field.state.value ?? ""}
        onChange={(_, v: string | string[] | null) => {
          // Never leave a group empty: a click on the last selected button is ignored.
          if (v !== null && v.length > 0) {
            field.handleChange(v);
          }
        }}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}
