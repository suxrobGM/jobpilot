"use client";

import type { ReactElement } from "react";
import { FormControlLabel, Switch as MuiSwitch } from "@mui/material";
import { useFieldContext } from "./form-context";

interface SwitchProps {
  label: string;
  disabled?: boolean;
}

/** TanStack Form-bound switch — wires a boolean field's value and change handler. */
export function Switch(props: SwitchProps): ReactElement {
  const { label, disabled } = props;
  const field = useFieldContext<boolean>();

  return (
    <FormControlLabel
      control={
        <MuiSwitch
          checked={Boolean(field.state.value)}
          onChange={(e) => field.handleChange(e.target.checked)}
          disabled={disabled}
        />
      }
      label={label}
    />
  );
}
