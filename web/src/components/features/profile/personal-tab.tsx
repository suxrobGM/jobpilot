"use client";

import { Stack } from "@mui/material";
import type { ReactElement } from "react";
import { FormSection } from "@/components/ui/form/form-section";
import { FormTextField } from "@/components/ui/form/form-text-field";
import type { AnyReactForm } from "@/components/ui/form/types";

interface PersonalTabProps {
  form: AnyReactForm;
}

export function PersonalTab(props: PersonalTabProps): ReactElement {
  const { form } = props;
  return (
    <FormSection title="Personal" description="Your name, contact, and links shared with employers.">
      <Stack direction="row" spacing={2}>
        <FormTextField form={form} name="firstName" label="First name" />
        <FormTextField form={form} name="lastName" label="Last name" />
      </Stack>
      <FormTextField form={form} name="email" label="Email" type="email" />
      <FormTextField form={form} name="phone" label="Phone" />
      <Stack direction="row" spacing={2}>
        <FormTextField form={form} name="website" label="Website" />
        <FormTextField form={form} name="linkedin" label="LinkedIn URL" />
      </Stack>
      <FormTextField form={form} name="github" label="GitHub URL" />
    </FormSection>
  );
}
