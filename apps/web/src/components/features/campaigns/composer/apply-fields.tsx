"use client";

import { MAX_APPLY_URLS } from "@jobpilot/contracts/campaign";
import { Stack } from "@mui/material";
import { withForm } from "@/components/ui/form/tanstack";
import { COMPOSER_DEFAULT_VALUES } from "./form-config";

/** Apply campaign fields: the pasted job links and an optional campaign label. */
export const ApplyFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  render: function ApplyFields({ form }) {
    return (
      <Stack spacing={2}>
        <form.AppField name="urlsText">
          {(field) => (
            <field.TextField
              label="URLs (one per line)"
              multiline
              rows={6}
              placeholder={
                "https://www.linkedin.com/jobs/view/...\nhttps://boards.greenhouse.io/..."
              }
              helperText={`One link per line, up to ${MAX_APPLY_URLS}. Extra spaces and commas are fine.`}
            />
          )}
        </form.AppField>
        <form.AppField name="applyLabel">
          {(field) => (
            <field.TextField
              label="Label (optional)"
              helperText="Names the campaign. Left blank, it's derived from the pasted links."
            />
          )}
        </form.AppField>
      </Stack>
    );
  },
});
