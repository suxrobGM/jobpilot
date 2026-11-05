"use client";

import { type ChangeEvent, type ReactElement, useState } from "react";
import {
  InputAdornment,
  TextField as MuiTextField,
  type TextFieldProps as MuiTextFieldProps,
} from "@mui/material";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

interface CurrencyProps
  extends Omit<MuiTextFieldProps, "value" | "onChange" | "onBlur" | "error" | "name" | "type"> {
  symbol?: string;
  locale?: string;
  allowDecimals?: boolean;
}

/** Grouped and symbol-prefixed while blurred, a raw number while focused; cleared stores undefined. */
export function Currency(props: CurrencyProps): ReactElement {
  const { helperText, symbol = "$", locale, allowDecimals = false, ...rest } = props;
  const field = useFieldContext<number | undefined>();
  const value = field.state.value;
  const errorText = firstErrorMessage(field.state.meta.errors);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: allowDecimals ? 2 : 0,
    useGrouping: true,
  });

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>("");

  let display = "";
  if (focused) {
    display = draft;
  } else if (value !== undefined) {
    display = formatter.format(value);
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const allowed = allowDecimals ? /[^\d.]/g : /[^\d]/g;
    let cleaned = e.target.value.replace(allowed, "");
    if (allowDecimals) {
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        cleaned = `${parts[0]}.${parts.slice(1).join("")}`;
      }
    }
    setDraft(cleaned);
    if (cleaned === "" || cleaned === ".") {
      field.handleChange(undefined);
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) {
      field.handleChange(parsed);
    }
  };

  return (
    <MuiTextField
      fullWidth
      value={display}
      inputMode={allowDecimals ? "decimal" : "numeric"}
      onFocus={() => {
        setDraft(value === undefined ? "" : String(value));
        setFocused(true);
      }}
      onChange={handleChange}
      onBlur={() => {
        setFocused(false);
        field.handleBlur();
      }}
      error={Boolean(errorText)}
      helperText={errorText ?? helperText}
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">{symbol}</InputAdornment>,
        },
      }}
      {...rest}
    />
  );
}
