"use client";

import { Stack } from "@mui/material";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { PROFILE_DEFAULT_VALUES } from "@/lib/schemas/profile";

export const AutoApplySection = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function AutoApplySection({ form }) {
    return (
      <FormSection
        title="Auto-apply"
        description="Defaults used by the auto-apply and apply skills."
      >
        <Stack direction="row" spacing={2}>
          <form.AppField name="autoApply.minMatchScore">
            {(field) => <field.TextField label="Min match score (0-100)" type="number" />}
          </form.AppField>
          <form.AppField name="autoApply.maxApplicationsPerRun">
            {(field) => (
              <field.TextField
                label="Max applications per run"
                type="number"
                helperText="Leave empty for unlimited"
              />
            )}
          </form.AppField>
        </Stack>
        <form.AppField name="autoApply.defaultStartDate">
          {(field) => <field.TextField label="Default start date answer" />}
        </form.AppField>
      </FormSection>
    );
  },
});
