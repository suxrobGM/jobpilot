"use client";

import { MAX_CONCURRENT_APPLIES } from "@jobpilot/contracts/pilot";
import { Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const LimitsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function LimitsSection({ form }) {
    return (
      <FormSection title="Operating limits">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="dailyApplyCap">
              {(field) => (
                <field.TextField
                  label="Daily apply cap"
                  type="number"
                  helperText="Max jobs applied per day."
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="maxConcurrentApplies">
              {(field) => (
                <field.TextField
                  label="Parallel applies"
                  type="number"
                  helperText="Applies at once, each in its own browser. Raise a step at a time: parallel submissions look less human."
                  slotProps={{ htmlInput: { min: 1, max: MAX_CONCURRENT_APPLIES, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="minScore">
              {(field) => (
                <field.TextField
                  label="Min score"
                  type="number"
                  helperText="Only apply to matches at or above this (0–100)."
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <form.AppField name="checkIntervalMinutes">
              {(field) => (
                <field.TextField
                  label="Check interval (min)"
                  type="number"
                  helperText="How often the pilot wakes to work."
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
        </Grid>
      </FormSection>
    );
  },
});
