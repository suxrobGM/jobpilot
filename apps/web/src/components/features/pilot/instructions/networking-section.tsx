"use client";

import { Grid, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

export const NetworkingSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function NetworkingSection({ form }) {
    const networkingEnabled = useSelector(form.store, (s) => s.values.networkingEnabled);

    return (
      <FormSection
        title="Networking"
        description="Let the pilot reach out to contacts at target companies, or leave it off to only apply."
      >
        <Stack spacing={2}>
          <form.AppField name="networkingEnabled">
            {(field) => <field.Switch label="Enable networking" />}
          </form.AppField>

          {networkingEnabled ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="dailyNetworkingCap">
                  {(field) => (
                    <field.TextField
                      label="Daily networking cap"
                      type="number"
                      helperText="Max networking messages per day."
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="networkingFollowupDays">
                  {(field) => (
                    <field.TextField
                      label="Networking follow-up (days)"
                      type="number"
                      helperText="Days to wait before following up."
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="networkingEmail">
                  {(field) => (
                    <field.Select
                      label="Networking email"
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
                <form.AppField name="networkingLinkedIn">
                  {(field) => (
                    <field.Select
                      label="Networking LinkedIn"
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
              The pilot won't compose, send, or follow up on networking messages - it only searches
              and applies.
            </Typography>
          )}
        </Stack>
      </FormSection>
    );
  },
});
