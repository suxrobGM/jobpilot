import { createFormHook } from "@tanstack/react-form";
import { Checkbox } from "./checkbox-field";
import { Currency } from "./currency-field";
import { FileUpload } from "./file-upload-field";
import { fieldContext, formContext } from "./form-context";
import { Multiselect } from "./multiselect-field";
import { Phone } from "./phone-field";
import { Select } from "./select-field";
import { SubmitButton } from "./submit-button";
import { Switch } from "./switch-field";
import { TextField } from "./text-field";
import { Toggle } from "./toggle-field";

/**
 * App-wide TanStack Form hook with bound, themed field/form components.
 *
 * Inside `form.AppField`, render a bound field via the `field` arg
 * (`<field.TextField />`, `<field.Phone />`, …). Each wraps a presentational
 * base in `form/`. Wrap form-level controls in `form.AppForm` and use
 * `form.SubmitButton`. Split large forms into typed pieces with `withForm`.
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    Select,
    Multiselect,
    Phone,
    Currency,
    Checkbox,
    Switch,
    Toggle,
    FileUpload,
  },
  formComponents: { SubmitButton },
});
