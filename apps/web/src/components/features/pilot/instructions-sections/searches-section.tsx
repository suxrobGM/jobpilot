"use client";

import { Grid, InputAdornment } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { INSTRUCTIONS_FORM_DEFAULTS } from "../instructions-form-schema";
import { InstructionsRowList } from "../instructions-row-list";
import { FieldInfo } from "./field-info";

const EMPTY_SEARCH = { query: "", board: "", cadenceHours: 24 };

export const SearchesSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function SearchesSection({ form }) {
    const searchCount = useSelector(form.store, (s) => s.values.savedSearches.length);
    const searchList = useKeyedList(searchCount);

    return (
      <FormSection
        title="Saved searches"
        description="Job searches the pilot re-runs on a schedule to discover new roles."
      >
        <form.AppField name="savedSearches" mode="array">
          {(field) => (
            <InstructionsRowList
              count={field.state.value?.length ?? 0}
              keys={searchList.keys}
              emptyText="No saved searches yet."
              addLabel="Add search"
              removeAria={(i) => `Remove search ${i + 1}`}
              rowLabel={(i) => `Search ${i + 1}`}
              // useKeyedList appends a key when the tracked length grows.
              onAdd={() => field.pushValue({ ...EMPTY_SEARCH })}
              onRemove={(i) => {
                searchList.onRemove(i);
                field.removeValue(i);
              }}
            >
              {(i) => (
                <>
                  <form.AppField name={`savedSearches[${i}].query`}>
                    {(sub) => (
                      <sub.TextField
                        label="Search keywords"
                        placeholder="senior react developer, remote"
                        helperText="Keywords the pilot searches for."
                      />
                    )}
                  </form.AppField>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 7 }}>
                      <form.AppField name={`savedSearches[${i}].board`}>
                        {(sub) => (
                          <sub.TextField
                            label="Board"
                            placeholder="linkedin.com"
                            helperText="Job-board domain to search. Leave blank to let the pilot choose."
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <FieldInfo title="A configured job board's domain, e.g. linkedin.com. Manage boards on the Boards page." />
                                ),
                              },
                            }}
                          />
                        )}
                      </form.AppField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <form.AppField name={`savedSearches[${i}].cadenceHours`}>
                        {(sub) => (
                          <sub.TextField
                            label="Re-run every"
                            type="number"
                            helperText="How often to re-run."
                            slotProps={{
                              htmlInput: { min: 1, step: 1 },
                              input: {
                                endAdornment: <InputAdornment position="end">hours</InputAdornment>,
                              },
                            }}
                          />
                        )}
                      </form.AppField>
                    </Grid>
                  </Grid>
                </>
              )}
            </InstructionsRowList>
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
