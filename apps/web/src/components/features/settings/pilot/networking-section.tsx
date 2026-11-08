"use client";

import { PILOT_EMAIL_AUTONOMY, PILOT_LINKEDIN_AUTONOMY } from "@jobpilot/contracts/pilot";
import { Alert, Grid } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { SETTINGS_FORM_DEFAULTS } from "./form-schema";

const AUTONOMY_ITEMS = {
  off: { label: "Off", description: "Never writes one." },
  draft: { label: "Draft only", description: "Writes it, never sends." },
  review: { label: "Review each", description: "Asks you before sending." },
  auto: { label: "Auto-send", description: "Sends on its own." },
};

const autonomyItems = (modes: readonly (keyof typeof AUTONOMY_ITEMS)[]) =>
  modes.map((value) => ({ value, ...AUTONOMY_ITEMS[value] }));

export const NetworkingSection = withForm({
  defaultValues: SETTINGS_FORM_DEFAULTS,
  render: function NetworkingSection({ form }) {
    const email = useSelector(form.store, (s) => s.values.networking.email);
    const linkedIn = useSelector(form.store, (s) => s.values.networking.linkedIn);
    const bothOff = email === "off" && linkedIn === "off";

    return (
      <FormSection
        title="Networking"
        description="Let the pilot reach out to contacts at target companies, or leave both channels off to only apply."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="networking.email">
              {(field) => (
                <field.Select label="Email" items={autonomyItems(PILOT_EMAIL_AUTONOMY)} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="networking.linkedIn">
              {(field) => (
                <field.Select label="LinkedIn" items={autonomyItems(PILOT_LINKEDIN_AUTONOMY)} />
              )}
            </form.AppField>
          </Grid>
          {bothOff && (
            <Grid size={12}>
              <Alert severity="info">
                Networking is off, so the pilot only searches and applies.
              </Alert>
            </Grid>
          )}
          {!bothOff && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name="networking.dailyCap">
                {(field) => (
                  <field.TextField
                    label="Messages per day"
                    type="number"
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  />
                )}
              </form.AppField>
            </Grid>
          )}
          {!bothOff && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <form.AppField name="networking.followupDays">
                {(field) => (
                  <field.TextField
                    label="Follow up after (days)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  />
                )}
              </form.AppField>
            </Grid>
          )}
        </Grid>
      </FormSection>
    );
  },
});
