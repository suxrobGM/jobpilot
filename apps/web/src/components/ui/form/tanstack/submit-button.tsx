"use client";

import type { ReactElement, ReactNode } from "react";
import { Button, type ButtonProps } from "@mui/material";
import { useFormContext } from "./form-context";

interface SubmitButtonProps extends Omit<ButtonProps, "type" | "children" | "loading"> {
  children: ReactNode;
}

/** `type="submit"`, so the enclosing `<form onSubmit>` drives submission. */
export function SubmitButton(props: SubmitButtonProps): ReactElement {
  const { children, disabled, ...rest } = props;
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || !canSubmit}
          loading={isSubmitting}
          {...rest}
        >
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}
