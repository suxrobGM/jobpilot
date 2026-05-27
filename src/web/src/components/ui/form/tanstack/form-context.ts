import { createFormHookContexts } from "@tanstack/react-form";

// Shared field/form contexts for the TanStack Form composition API. Kept in its
// own module so bound field components can read the contexts without a circular
// dependency on the `createFormHook` call in `index.ts`.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
