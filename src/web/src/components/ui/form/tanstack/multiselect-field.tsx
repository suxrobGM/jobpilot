"use client";

import type { ReactElement } from "react";
import { MultiSelect as BaseMultiSelect, type MultiSelectProps } from "../multi-select";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

type MultiselectProps = Omit<MultiSelectProps, "value" | "onChange" | "onBlur" | "errorText">;

/** TanStack Form-bound multi-select — wires a `string[]` field to the base MultiSelect. */
export function Multiselect(props: MultiselectProps): ReactElement {
  const field = useFieldContext<string[]>();

  return (
    <BaseMultiSelect
      value={field.state.value ?? []}
      onChange={(v) => field.handleChange(v)}
      onBlur={field.handleBlur}
      errorText={firstErrorMessage(field.state.meta.errors)}
      {...props}
    />
  );
}
