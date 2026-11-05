import { createFormHook } from "@tanstack/react-form";
import { Currency } from "./currency-field";
import { fieldContext, formContext } from "./form-context";
import { MultiSelect } from "./multi-select-field";
import { Phone } from "./phone-field";
import { Select } from "./select-field";
import { SubmitButton } from "./submit-button";
import { Switch } from "./switch-field";
import { TextField } from "./text-field";
import { Toggle } from "./toggle-field";

/** Inside `form.AppField`, render a bound field from the `field` arg, e.g. `<field.TextField />`. */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, Select, MultiSelect, Phone, Currency, Switch, Toggle },
  formComponents: { SubmitButton },
});
