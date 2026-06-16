"use client";

import { PROFILE_DEFAULT_VALUES } from "@jobpilot/contracts/profile";
import { Stack } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

export const AddressSection = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function AddressSection({ form }) {
    return (
      <FormSection
        title="Address"
        description="Used to autofill applications that ask for a postal address."
      >
        <form.AppField name="street">{(field) => <field.TextField label="Street" />}</form.AppField>
        <form.AppField name="aptUnit">
          {(field) => <field.TextField label="Apt / Unit" />}
        </form.AppField>
        <Stack direction="row" spacing={2}>
          <form.AppField name="city">{(field) => <field.TextField label="City" />}</form.AppField>
          <form.AppField name="state">
            {(field) => <field.TextField label="State / Region" />}
          </form.AppField>
          <form.AppField name="zipCode">
            {(field) => <field.TextField label="ZIP / Postal" />}
          </form.AppField>
        </Stack>
        <form.AppField name="country">
          {(field) => <field.TextField label="Country" />}
        </form.AppField>
      </FormSection>
    );
  },
});
