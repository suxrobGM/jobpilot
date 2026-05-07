"use client";

import type { ReactElement } from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { AnyReactForm } from "./types";

interface FormTextFieldProps extends Omit<
  TextFieldProps,
  "value" | "onChange" | "onBlur" | "error" | "name"
> {
  form: AnyReactForm;
  name: string;
  transform?: (value: string) => string;
}

export function FormTextField(props: FormTextFieldProps): ReactElement {
  const { form, name, transform, helperText, ...rest } = props;
  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => {
        const value = (field.state.value as string | undefined) ?? "";
        const errMsg =
          (field.state.meta.errors[0] as { message?: string } | undefined)?.message ??
          field.state.meta.errors[0]?.toString();
        return (
          <TextField
            fullWidth
            value={value}
            onChange={(e) =>
              field.handleChange(transform ? transform(e.target.value) : e.target.value)
            }
            onBlur={field.handleBlur}
            error={field.state.meta.errors.length > 0}
            helperText={errMsg ?? helperText}
            {...rest}
          />
        );
      }}
    </form.Field>
  );
}
