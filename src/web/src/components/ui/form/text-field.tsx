"use client";

import { useState, type ReactElement } from "react";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  IconButton,
  InputAdornment,
  TextField as MuiTextField,
  Tooltip,
  type TextFieldProps as MuiTextFieldProps,
} from "@mui/material";

export interface TextFieldProps extends Omit<MuiTextFieldProps, "error"> {
  /** Error message; when set the field renders in its error state and shows the text below. */
  errorText?: string;
}

/**
 * Themed text input built on MUI's TextField with inline error text and a
 * built-in show/hide toggle for `type="password"`. Presentational and
 * controlled — pass `value`/`onChange` (no form coupling).
 */
export function TextField(props: TextFieldProps): ReactElement {
  const { errorText, helperText, type, slotProps, ...rest } = props;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const effectiveType = isPassword && showPassword ? "text" : type;

  const passwordAdornment = isPassword && (
    <InputAdornment position="end">
      <Tooltip title={showPassword ? "Hide password" : "Show password"}>
        <IconButton
          onClick={() => setShowPassword((v) => !v)}
          onMouseDown={(e) => e.preventDefault()}
          edge="end"
          size="small"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <MuiTextField
      fullWidth
      type={effectiveType}
      error={Boolean(errorText)}
      helperText={errorText ?? helperText}
      slotProps={{
        ...slotProps,
        input: {
          ...(slotProps?.input as object),
          ...(isPassword ? { endAdornment: passwordAdornment } : {}),
        },
      }}
      {...rest}
    />
  );
}
