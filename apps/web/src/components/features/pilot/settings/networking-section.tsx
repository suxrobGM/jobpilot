"use client";

import { PILOT_EMAIL_AUTONOMY, PILOT_LINKEDIN_AUTONOMY } from "@jobpilot/contracts/pilot";
import { Alert, Grid } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

const AUTONOMY_LABELS = {
  off: "Off",
  draft: "Draft only",
  review: "Review each",
  auto: "Auto-send",
};

const autonomyItems = (modes: readonly (keyof typeof AUTONOMY_LABELS)[]) =>
  modes.map((value) => ({ value, label: AUTONOMY_LABELS[value] }));

export const NetworkingSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function NetworkingSection({ form }) {
    const email = useSelector(form.store, (s) => s.values.networking.email);
    const linkedIn = useSelector(form.store, (s) => s.values.networking.linkedIn);
    const bothOff = email === "off" && linkedIn === "off";

    return (
      <FormSection
        title="Networking"
        description="Let the pilot reach out to contacts at target companies, or leave it off to only apply."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="networking.dailyCap">
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
            <form.AppField name="networking.followupDays">
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
            <form.AppField name="networking.email">
              {(field) => (
                <field.Select
                  label="Networking email"
                  helperText="Off: never writes one. Draft only: writes it but never sends. Review each: asks you first. Auto-send: sends on its own."
                  items={autonomyItems(PILOT_EMAIL_AUTONOMY)}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="networking.linkedIn">
              {(field) => (
                <field.Select
                  label="Networking LinkedIn"
                  helperText="Off: never writes one. Draft only: writes it but never sends. Review each: asks you first."
                  items={autonomyItems(PILOT_LINKEDIN_AUTONOMY)}
                />
              )}
            </form.AppField>
          </Grid>
          {bothOff && (
            <Grid size={12}>
              <Alert severity="info">
                Both channels are off, so the pilot only searches and applies. Turn one on to let it
                reach out.
              </Alert>
            </Grid>
          )}
        </Grid>
      </FormSection>
    );
  },
});
