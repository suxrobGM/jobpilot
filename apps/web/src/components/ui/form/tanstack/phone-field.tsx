"use client";

import type { ReactElement, ReactNode } from "react";
import type { CountryCode } from "libphonenumber-js";
import { PhoneField as BasePhoneField } from "../phone-field";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

interface PhoneProps {
  label?: string;
  placeholder?: string;
  helperText?: ReactNode;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
}

export function Phone(props: PhoneProps): ReactElement {
  const { helperText, ...rest } = props;
  const field = useFieldContext<string | null | undefined>();
  const errMsg = firstErrorMessage(field.state.meta.errors);

  return (
    <BasePhoneField
      name={field.name}
      value={field.state.value ?? ""}
      onChange={(next) => field.handleChange(next)}
      onBlur={field.handleBlur}
      errorText={errMsg}
      helperText={helperText}
      {...rest}
    />
  );
}
