"use client";

import { Checkbox, FormControlLabel } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactElement } from "react";
import type { AnyReactForm } from "./types";

interface FormCheckboxFieldProps {
  form: AnyReactForm;
  name: string;
  label: string;
  disabled?: boolean;
}

export function FormCheckboxField(props: FormCheckboxFieldProps): ReactElement {
  const { form, name, label, disabled } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(field.state.value)}
              onChange={(e) => field.handleChange(e.target.checked)}
              disabled={disabled}
            />
          }
          label={label}
        />
      )}
    </form.Field>
  );
}
