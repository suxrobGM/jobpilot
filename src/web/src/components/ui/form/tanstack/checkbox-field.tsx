"use client";

import type { ReactElement } from "react";
import { FormControlLabel, Checkbox as MuiCheckbox } from "@mui/material";
import { useFieldContext } from "./form-context";

interface CheckboxProps {
  label: string;
  disabled?: boolean;
}

/** TanStack Form-bound checkbox — wires a boolean field's value and change handler. */
export function Checkbox(props: CheckboxProps): ReactElement {
  const { label, disabled } = props;
  const field = useFieldContext<boolean>();

  return (
    <FormControlLabel
      control={
        <MuiCheckbox
          checked={Boolean(field.state.value)}
          onChange={(e) => field.handleChange(e.target.checked)}
          disabled={disabled}
        />
      }
      label={label}
    />
  );
}
