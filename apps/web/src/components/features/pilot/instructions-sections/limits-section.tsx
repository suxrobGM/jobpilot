"use client";

import { Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";

export const LimitsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function LimitsSection({ form }) {
    return (
      <FormSection title="Operating limits">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name="dailyOutreachCap">
              {(field) => (
                <field.TextField
                  label="Daily outreach cap"
                  type="number"
                  helperText="Max outreach messages per day."
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name="outreachFollowupDays">
              {(field) => (
                <field.TextField
                  label="Outreach follow-up (days)"
                  type="number"
                  helperText="Days to wait before following up."
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
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
