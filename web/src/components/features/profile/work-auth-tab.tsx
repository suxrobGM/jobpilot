"use client";

import type { ReactElement } from "react";
import { FormMultiselectField } from "@/components/ui/form/form-multiselect-field";
import { FormSection } from "@/components/ui/form/form-section";
import { FormSwitchField } from "@/components/ui/form/form-switch-field";
import { FormTextField } from "@/components/ui/form/form-text-field";
import type { AnyReactForm } from "@/components/ui/form/types";

interface WorkAuthTabProps {
  form: AnyReactForm;
}

export function WorkAuthTab(props: WorkAuthTabProps): ReactElement {
  const { form } = props;
  return (
    <FormSection title="Work authorization" description="What employers ask on every application.">
      <FormSwitchField form={form} name="usAuthorized" label="Authorized to work in the US" />
      <FormSwitchField form={form} name="requiresSponsorship" label="Requires visa sponsorship" />
      <FormTextField
        form={form}
        name="visaStatus"
        label="Visa status (e.g. OPT, H1B, GC, Citizen)"
      />
      <FormTextField form={form} name="optExtension" label="OPT extension (e.g. STEM)" />
      <FormSwitchField form={form} name="willingToRelocate" label="Willing to relocate" />
      <FormMultiselectField
        form={form}
        name="preferredLocations"
        label="Preferred locations"
        placeholder="Type a city and press Enter"
      />
    </FormSection>
  );
}
