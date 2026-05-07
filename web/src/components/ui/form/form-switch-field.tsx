"use client";

import { FormControlLabel, Switch } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactElement } from "react";
import type { AnyReactForm } from "./types";

interface FormSwitchFieldProps {
  form: AnyReactForm;
  name: string;
  label: string;
  disabled?: boolean;
}

export function FormSwitchField(props: FormSwitchFieldProps): ReactElement {
  const { form, name, label, disabled } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <FormControlLabel
          control={
            <Switch
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
