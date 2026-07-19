"use client";

import { Grid, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const OutreachSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function OutreachSection({ form }) {
    const outreachEnabled = useSelector(form.store, (s) => s.values.outreachEnabled);

    return (
      <FormSection
        title="Outreach"
        description="Let the pilot reach out to contacts at target companies, or leave it off to only apply."
      >
        <Stack spacing={2}>
          <form.AppField name="outreachEnabled">
            {(field) => <field.Switch label="Enable outreach" />}
          </form.AppField>

          {outreachEnabled ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              <Grid size={{ xs: 12, sm: 6 }}>
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
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="outreachEmail">
                  {(field) => (
                    <field.Select
                      label="Outreach email"
                      helperText="Draft only: never sends. Review each: asks you first. Auto-send: sends automatically."
                      items={[
                        { value: "draft", label: "Draft only" },
                        { value: "review", label: "Review each" },
                        { value: "auto", label: "Auto-send" },
                      ]}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="outreachLinkedIn">
                  {(field) => (
                    <field.Select
                      label="Outreach LinkedIn"
                      helperText="Draft only: never sends. Review each: asks you first."
                      items={[
                        { value: "draft", label: "Draft only" },
                        { value: "review", label: "Review each" },
                      ]}
                    />
                  )}
                </form.AppField>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2Muted">
              The pilot won't compose, send, or follow up on outreach - it only searches and
              applies.
            </Typography>
          )}
        </Stack>
      </FormSection>
    );
  },
});
