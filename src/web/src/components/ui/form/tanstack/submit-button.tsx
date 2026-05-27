"use client";

import type { ReactElement, ReactNode } from "react";
import { Button, type ButtonProps } from "@mui/material";
import { useFormContext } from "./form-context";

interface SubmitButtonProps extends Omit<ButtonProps, "type" | "children"> {
  children: ReactNode;
}

/**
 * TanStack Form-bound submit button — subscribes to `canSubmit` / `isSubmitting`
 * and renders a `type="submit"` button, so the enclosing `<form onSubmit>` drives
 * submission. Pass `disabled` to fold in external state (e.g. a pending mutation).
 */
export function SubmitButton(props: SubmitButtonProps): ReactElement {
  const { children, disabled, ...rest } = props;
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !canSubmit || isSubmitting}
          {...rest}
        >
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}
