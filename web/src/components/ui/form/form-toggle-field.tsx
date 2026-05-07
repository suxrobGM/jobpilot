"use client";

import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactElement } from "react";
import type { AnyReactForm } from "./types";

interface ToggleOption {
  value: string;
  label: string;
}

interface FormToggleFieldProps {
  form: AnyReactForm;
  name: string;
  label?: string;
  options: ReadonlyArray<ToggleOption>;
  exclusive?: boolean;
}

export function FormToggleField(props: FormToggleFieldProps): ReactElement {
  const { form, name, label, options, exclusive = true } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <Stack spacing={0.5}>
          {label && <Typography variant="body2Muted">{label}</Typography>}
          <ToggleButtonGroup
            size="small"
            exclusive={exclusive}
            value={field.state.value ?? ""}
            onChange={(_, v) => {
              if (exclusive ? v !== null : v.length > 0) field.handleChange(v);
            }}
          >
            {options.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}
    </form.Field>
  );
}
