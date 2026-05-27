"use client";

import type { ReactElement } from "react";
import { CurrencyField as BaseCurrencyField, type CurrencyFieldProps } from "../currency-field";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

type CurrencyProps = Omit<CurrencyFieldProps, "value" | "onChange" | "onBlur" | "errorText">;

/** TanStack Form-bound currency field — wires a numeric field to the base CurrencyField. */
export function Currency(props: CurrencyProps): ReactElement {
  const field = useFieldContext<number | undefined>();

  return (
    <BaseCurrencyField
      value={field.state.value}
      onChange={(v) => field.handleChange(v)}
      onBlur={field.handleBlur}
      errorText={firstErrorMessage(field.state.meta.errors)}
      {...props}
    />
  );
}
