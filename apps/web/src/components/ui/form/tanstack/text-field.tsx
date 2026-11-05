"use client";

import { type ReactElement, useState } from "react";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  IconButton,
  InputAdornment,
  TextField as MuiTextField,
  type TextFieldProps as MuiTextFieldProps,
  Tooltip,
} from "@mui/material";
import { firstErrorMessage } from "./error-message";
import { useFieldContext } from "./form-context";

type FieldValue = string | number | null | undefined;

interface TextFieldProps
  extends Omit<MuiTextFieldProps, "value" | "onChange" | "onBlur" | "error" | "name"> {
  transform?: (value: string) => string;
}

/** `type="number"` stores a number (null when cleared); `type="password"` gets a show/hide toggle. */
export function TextField(props: TextFieldProps): ReactElement {
  const { transform, type, helperText, slotProps, ...rest } = props;
  const field = useFieldContext<FieldValue>();
  const [showPassword, setShowPassword] = useState(false);
  const isNumber = type === "number";
  const isPassword = type === "password";
  const errorText = firstErrorMessage(field.state.meta.errors);

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
          {showPassword ? <VisibilityOff fontSize="sm" /> : <Visibility fontSize="sm" />}
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <MuiTextField
      fullWidth
      type={isPassword && showPassword ? "text" : type}
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
