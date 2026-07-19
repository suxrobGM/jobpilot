"use client";

import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const GoalsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function GoalsSection({ form }) {
    return (
      <FormSection title="Goals">
        <form.AppField name="goals">
          {(field) => (
            <field.TextField
              label="Goals"
              multiline
              minRows={3}
              placeholder="e.g. Prioritize senior frontend roles at Series A-C startups, remote or NYC. Must sponsor F1/OPT. Skip crypto and agencies. Lead with my React and design-systems work."
              helperText="Plain-language direction for the pilot: roles, priorities, constraints."
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
