"use client";

import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { PROFILE_DEFAULT_VALUES } from "@/lib/schemas/profile";

export const WorkAuthSection = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function WorkAuthSection({ form }) {
    return (
      <FormSection
        title="Work authorization"
        description="What employers ask on every application."
      >
        <form.AppField name="usAuthorized">
          {(field) => <field.Switch label="Authorized to work in the US" />}
        </form.AppField>
        <form.AppField name="requiresSponsorship">
          {(field) => <field.Switch label="Requires visa sponsorship" />}
        </form.AppField>
        <form.AppField name="visaStatus">
          {(field) => <field.TextField label="Visa status (e.g. OPT, H1B, GC, Citizen)" />}
        </form.AppField>
        <form.AppField name="optExtension">
          {(field) => <field.TextField label="OPT extension (e.g. STEM)" />}
        </form.AppField>
        <form.AppField name="willingToRelocate">
          {(field) => <field.Switch label="Willing to relocate" />}
        </form.AppField>
        <form.AppField name="preferredLocations">
          {(field) => (
            <field.Multiselect
              label="Preferred locations"
              placeholder="Type a city and press Enter"
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
