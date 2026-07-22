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
              minRows={6}
              maxRows={20}
              placeholder="e.g. Prioritize senior frontend roles at Series A-C startups, remote or NYC. Must sponsor F1/OPT. Skip crypto and agencies. Lead with my React and design-systems work."
              helperText="Plain-language direction: roles, priorities, constraints. The pilot creates and re-runs its own searches from these goals, so give it the full picture."
              // Goals are the pilot's whole steering input, so let the user drag the box taller.
              sx={{ "& textarea": { resize: "vertical" } }}
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
