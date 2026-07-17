"use client";

import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";

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
              helperText="Plain-language direction for the pilot: roles, priorities, constraints."
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
