"use client";

import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

export const PersonalSection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function PersonalSection({ form }) {
    return (
      <FormSection
        title="Personal"
        description="Your name, contact, and links shared with employers."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="firstName">
              {(field) => <field.TextField label="First name" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="lastName">
              {(field) => <field.TextField label="Last name" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="contactEmail">
              {(field) => <field.TextField label="Contact email" type="email" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="phone">{(field) => <field.Phone label="Phone" />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <form.AppField name="website">
              {(field) => <field.TextField label="Website" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <form.AppField name="linkedin">
              {(field) => <field.TextField label="LinkedIn URL" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <form.AppField name="github">
              {(field) => <field.TextField label="GitHub URL" />}
            </form.AppField>
          </Grid>
        </Grid>
      </FormSection>
    );
  },
});
