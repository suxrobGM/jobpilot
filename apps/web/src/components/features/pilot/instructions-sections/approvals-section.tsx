"use client";

import { Grid } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";

export const ApprovalsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function ApprovalsSection({ form }) {
    return (
      <FormSection title="Approvals" description="How the pilot handles outreach it composes.">
        <Grid container spacing={2}>
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
      </FormSection>
    );
  },
});
