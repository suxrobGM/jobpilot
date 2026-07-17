"use client";

import { Grid, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";

export const ActiveHoursSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function ActiveHoursSection({ form }) {
    const activeHoursEnabled = useSelector(form.store, (s) => s.values.activeHoursEnabled);

    return (
      <FormSection
        title="Active hours"
        description="Restrict cycles to a window, or leave off to run around the clock."
      >
        <Stack spacing={2}>
          <form.AppField name="activeHoursEnabled">
            {(field) => <field.Switch label="Restrict to active hours" />}
          </form.AppField>
          {activeHoursEnabled && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="activeHoursStart">
                  {(field) => <field.TextField label="Start (HH:MM)" placeholder="09:00" />}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="activeHoursEnd">
                  {(field) => <field.TextField label="End (HH:MM)" placeholder="17:00" />}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="activeHoursTz">
                  {(field) => <field.TextField label="Time zone" />}
                </form.AppField>
              </Grid>
            </Grid>
          )}
        </Stack>
      </FormSection>
    );
  },
});
