"use client";

import type { ReactElement } from "react";
import { MultiSelect as BaseMultiSelect, type MultiSelectProps } from "../multi-select";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

type MultiSelectFieldProps = Omit<MultiSelectProps, "value" | "onChange" | "onBlur" | "errorText">;

export function MultiSelect(props: MultiSelectFieldProps): ReactElement {
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
