"use client";

import { Slider, Stack, Typography } from "@mui/material";
import { withForm } from "@/components/ui/form/tanstack";
import { COMPOSER_DEFAULT_VALUES } from "./form-config";

/** Auto-apply campaign fields: minimum match score and an optional application cap. */
export const AutoApplyFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  render: function AutoApplyFields({ form }) {
    return (
      <Stack spacing={2}>
        <form.AppField name="minScore">
          {(field) => (
            <Stack spacing={0.5}>
              <Typography variant="body2Muted">Min match score: {field.state.value}</Typography>
              <Slider
                value={field.state.value}
                min={0}
                max={100}
                step={5}
                marks
                valueLabelDisplay="auto"
                onChange={(_, v) => field.handleChange(v as number)}
              />
            </Stack>
          )}
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
