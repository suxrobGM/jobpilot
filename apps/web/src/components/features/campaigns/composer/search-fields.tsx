"use client";

import { withForm } from "@/components/ui/form/tanstack";
import { COMPOSER_DEFAULT_VALUES } from "./form-config";

/** Search-only campaign fields: how many results to rank. */
export const SearchFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  render: function SearchFields({ form }) {
    return (
      <form.AppField name="maxJobs">
        {(field) => (
          <field.TextField
            label="Jobs to search"
            type="number"
            helperText="How many results to rank (1–100)."
            slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
          />
        )}
      </form.AppField>
    );
  },
});
