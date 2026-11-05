"use client";

import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const CheckIntervalSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function CheckIntervalSection({ form }) {
    return (
      <FormSection title="Schedule">
        <form.AppField name="checkIntervalMinutes">
          {(field) => (
            <field.TextField
              label="Check interval (min)"
              type="number"
              helperText="How often the pilot wakes to look for work."
              slotProps={{ htmlInput: { min: 5, step: 1 } }}
            />
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
