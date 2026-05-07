"use client";

import { Stack } from "@mui/material";
import type { ReactElement } from "react";
import { FormSection } from "@/components/ui/form/form-section";
import { FormTextField } from "@/components/ui/form/form-text-field";
import type { AnyReactForm } from "@/components/ui/form/types";

interface AddressTabProps {
  form: AnyReactForm;
}

export function AddressTab(props: AddressTabProps): ReactElement {
  const { form } = props;
  return (
    <FormSection title="Address" description="Used to autofill applications that ask for a postal address.">
      <FormTextField form={form} name="street" label="Street" />
      <FormTextField form={form} name="aptUnit" label="Apt / Unit" />
      <Stack direction="row" spacing={2}>
        <FormTextField form={form} name="city" label="City" />
        <FormTextField form={form} name="state" label="State / Region" />
        <FormTextField form={form} name="zipCode" label="ZIP / Postal" />
      </Stack>
      <FormTextField form={form} name="country" label="Country" />
    </FormSection>
  );
}
