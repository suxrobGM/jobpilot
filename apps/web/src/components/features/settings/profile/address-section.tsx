"use client";

import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

export const AddressSection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function AddressSection({ form }) {
    return (
      <FormSection
        title="Address"
        description="Used to autofill applications that ask for a postal address."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <form.AppField name="street">
              {(field) => <field.TextField label="Street" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name="aptUnit">
              {(field) => <field.TextField label="Apt / Unit" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="city">{(field) => <field.TextField label="City" />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="state">
              {(field) => <field.TextField label="State / Region" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="zipCode">
              {(field) => <field.TextField label="ZIP / Postal" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="country">
              {(field) => <field.TextField label="Country" />}
            </form.AppField>
          </Grid>
        </Grid>
      </FormSection>
    );
  },
});
