"use client";

import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { SETTINGS_FORM_DEFAULTS } from "./form-schema";
import { JobAlertsSetting } from "./job-alerts-setting";

export const ScheduleSection = withForm({
  defaultValues: SETTINGS_FORM_DEFAULTS,
  render: function ScheduleSection({ form }) {
    return (
      <FormSection title="Schedule">
        <form.AppField name="checkIntervalMinutes">
          {(field) => (
            <field.TextField
              label="Check interval (min)"
              type="number"
              helperText="How often an idle pilot wakes to look for work."
              slotProps={{ htmlInput: { min: 5, step: 1 } }}
            />
          )}
        </form.AppField>
        <JobAlertsSetting />
      </FormSection>
    );
  },
});
