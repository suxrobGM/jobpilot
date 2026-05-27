"use client";

import { Stack } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { PROFILE_DEFAULT_VALUES } from "@/lib/schemas/profile";

export const PersonalSection = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function PersonalSection({ form }) {
    return (
      <FormSection
        title="Personal"
        description="Your name, contact, and links shared with employers."
      >
        <Stack direction="row" spacing={2}>
          <form.AppField name="firstName">
            {(field) => <field.TextField label="First name" />}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => <field.TextField label="Last name" />}
          </form.AppField>
        </Stack>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" />}
        </form.AppField>
        <form.AppField name="phone">{(field) => <field.Phone label="Phone" />}</form.AppField>
        <Stack direction="row" spacing={2}>
          <form.AppField name="website">
            {(field) => <field.TextField label="Website" />}
          </form.AppField>
          <form.AppField name="linkedin">
            {(field) => <field.TextField label="LinkedIn URL" />}
          </form.AppField>
        </Stack>
        <form.AppField name="github">
          {(field) => <field.TextField label="GitHub URL" />}
        </form.AppField>
      </FormSection>
    );
  },
});
