"use client";

import { useState, type ChangeEvent, type ReactElement } from "react";
import {
  InputAdornment,
  TextField as MuiTextField,
  type TextFieldProps as MuiTextFieldProps,
} from "@mui/material";

export interface CurrencyFieldProps extends Omit<
  MuiTextFieldProps,
  "value" | "onChange" | "onBlur" | "error" | "name" | "type"
> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  errorText?: string;
  symbol?: string;
  locale?: string;
  allowDecimals?: boolean;
}

/**
 * Themed currency input: shows a grouped, symbol-prefixed value when blurred and
 * a raw editable number while focused. Presentational and controlled — emits the
 * parsed numeric value (or `undefined` when cleared) via `onChange`.
 */
export function CurrencyField(props: CurrencyFieldProps): ReactElement {
  const {
    value,
    onChange,
    onBlur,
    errorText,
    helperText,
    symbol = "$",
    locale,
    allowDecimals = false,
    ...rest
  } = props;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: allowDecimals ? 2 : 0,
    useGrouping: true,
  });

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const display = focused ? draft : value === undefined ? "" : formatter.format(value);

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
      onChange(undefined);
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
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
        onBlur?.();
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
