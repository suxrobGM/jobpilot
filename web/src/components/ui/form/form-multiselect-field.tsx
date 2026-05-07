"use client";

import type { ReactElement } from "react";
import { Autocomplete, TextField } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { AnyReactForm } from "./types";

interface FormMultiselectFieldProps {
  form: AnyReactForm;
  name: string;
  label?: string;
  options?: ReadonlyArray<string>;
  freeSolo?: boolean;
  placeholder?: string;
}

export function FormMultiselectField(props: FormMultiselectFieldProps): ReactElement {
  const { form, name, label, options = [], freeSolo = true, placeholder } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => (
        <Autocomplete
          multiple
          freeSolo={freeSolo}
          options={[...options]}
          value={(field.state.value as string[] | undefined) ?? []}
          onChange={(_, v) => field.handleChange(v)}
          renderInput={(params) => (
            <TextField {...params} label={label} placeholder={placeholder} />
          )}
        />
      )}
    </form.Field>
  );
}
