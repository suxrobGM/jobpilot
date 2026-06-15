"use client";

import type { ReactElement } from "react";
import type { TextFieldProps as MuiTextFieldProps } from "@mui/material";
import { TextField as BaseTextField } from "../text-field";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

type FieldValue = string | number | null | undefined;

interface TextFieldProps extends Omit<
  MuiTextFieldProps,
  "value" | "onChange" | "onBlur" | "error" | "name"
> {
  transform?: (value: string) => string;
}

/** TanStack Form-bound text field — wires value/change/blur and validation errors to the base TextField. */
export function TextField(props: TextFieldProps): ReactElement {
  const { transform, type, ...rest } = props;
  const field = useFieldContext<FieldValue>();
  const isNumber = type === "number";

  return (
    <BaseTextField
      type={type}
      value={field.state.value ?? ""}
      onChange={(e) => {
        const next = e.target.value;
        if (isNumber) {
          field.handleChange(next === "" ? null : Number(next));
          return;
        }
        field.handleChange(transform ? transform(next) : next);
      }}
      onBlur={field.handleBlur}
      errorText={firstErrorMessage(field.state.meta.errors)}
      {...rest}
    />
  );
}
