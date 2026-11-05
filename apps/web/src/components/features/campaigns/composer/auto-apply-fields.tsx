"use client";

import { Stack } from "@mui/material";
import { withForm } from "@/components/ui/form/tanstack";
import { MinScoreSlider } from "../min-score-slider";
import { COMPOSER_DEFAULT_VALUES } from "./form-config";

/** Auto-apply campaign fields: minimum match score and an optional application cap. */
export const AutoApplyFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  render: function AutoApplyFields({ form }) {
    return (
      <Stack spacing={2}>
        <form.AppField name="minScore">
          {(field) => <MinScoreSlider value={field.state.value} onChange={field.handleChange} />}
        </form.AppField>
        <form.AppField name="maxApps">
          {(field) => (
            <field.TextField
              label="Max applications"
              type="number"
              helperText="Leave empty for unlimited."
              slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
            />
          )}
        </form.AppField>
      </Stack>
    );
  },
});
