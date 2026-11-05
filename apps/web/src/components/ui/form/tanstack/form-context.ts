import { createFormHookContexts } from "@tanstack/react-form";

// Own module, so bound fields avoid a cycle through `createFormHook` in `index.ts`.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
