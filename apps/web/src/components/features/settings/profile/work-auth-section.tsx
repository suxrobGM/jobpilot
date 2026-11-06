"use client";

import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { Alert, Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";

const OPT_PATTERN = /\bopt\b/i;
// Statuses that expire or need an employer petition; application forms count them as sponsorship.
const SPONSORED_STATUS_PATTERN = /\b(f-?1|opt|cpt|h-?1b|j-?1)\b/i;

export const WorkAuthSection = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function WorkAuthSection({ form }) {
    return (
      <FormSection
        title="Work authorization"
        description="What employers ask on every application."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="usAuthorized">
              {(field) => <field.Switch label="Authorized to work in the US" />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name="requiresSponsorship">
              {(field) => <field.Switch label="Requires visa sponsorship" />}
            </form.AppField>
          </Grid>
          <form.Subscribe
            selector={(state) => ({
              visaStatus: state.values.visaStatus ?? "",
              requiresSponsorship: state.values.requiresSponsorship,
            })}
          >
            {({ visaStatus, requiresSponsorship }) => {
              const onOpt = OPT_PATTERN.test(visaStatus);
              const likelySponsored = SPONSORED_STATUS_PATTERN.test(visaStatus);
              return (
                <>
                  {likelySponsored && !requiresSponsorship && (
                    <Grid size={12}>
                      <Alert severity="warning">
                        {`Most application forms count ${visaStatus.trim()} as needing sponsorship now or later. Turn on "Requires visa sponsorship" unless you're sure.`}
                      </Alert>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: onOpt ? 6 : 12 }}>
                    <form.AppField name="visaStatus">
                      {(field) => (
                        <field.TextField label="Visa status (e.g. OPT, H1B, GC, Citizen)" />
                      )}
                    </form.AppField>
                  </Grid>
                  {onOpt && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <form.AppField name="optExtension">
                        {(field) => <field.TextField label="OPT extension (e.g. STEM)" />}
                      </form.AppField>
                    </Grid>
                  )}
                </>
              );
            }}
          </form.Subscribe>
          <Grid size={12}>
            <form.AppField name="willingToRelocate">
              {(field) => <field.Switch label="Willing to relocate" />}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name="preferredLocations">
              {(field) => (
                <field.MultiSelect
                  label="Preferred locations"
                  placeholder="Type a city and press Enter"
                />
              )}
            </form.AppField>
          </Grid>
        </Grid>
      </FormSection>
    );
  },
});
