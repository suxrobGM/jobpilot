import { createFormHook } from "@tanstack/react-form";
import { ApiError } from "@/api/error";
import { Currency } from "./currency-field";
import { fieldContext, formContext } from "./form-context";
import { MultiSelect } from "./multi-select-field";
import { Phone } from "./phone-field";
import { Select } from "./select-field";
import { SubmitButton } from "./submit-button";
import { Switch } from "./switch-field";
import { TextField } from "./text-field";
import { Toggle } from "./toggle-field";
import { UnsavedChangesBar } from "./unsaved-changes-bar";

/** Inside `form.AppField`, render a bound field from the `field` arg, e.g. `<field.TextField />`. */
const formHook = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, Select, MultiSelect, Phone, Currency, Switch, Toggle },
  formComponents: { SubmitButton, UnsavedChangesBar },
});

export const { withForm } = formHook;

// The mutation's onError already showed an ApiError; TanStack would rethrow it unhandled.
function rethrowUnlessApiError(error: unknown): void {
  if (!(error instanceof ApiError)) {
    throw error;
  }
}

export const useAppForm: typeof formHook.useAppForm = (options) =>
  formHook.useAppForm({
    ...options,
    onSubmit: async (props) => {
      await Promise.resolve(options.onSubmit?.(props)).catch(rethrowUnlessApiError);
    },
  });
