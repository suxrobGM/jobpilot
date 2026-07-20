"use client";

import { Grid, InputAdornment } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useApiQuery } from "@/api/hooks";
import { jobBoardQueries } from "@/api/queries";
import { FieldRowList, FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";

const EMPTY_SEARCH = { query: "", board: "", cadenceHours: 24, resumeId: undefined };

export const SearchesSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function SearchesSection({ form }) {
    const searchCount = useSelector(form.store, (s) => s.values.savedSearches.length);
    const searchList = useKeyedList(searchCount);
    const boardsQuery = useApiQuery(jobBoardQueries.list());
    const domains = boardsQuery.data?.map((board) => board.domain) ?? [];

    return (
      <FormSection
        title="Saved searches"
        description="The pilot creates and re-runs these from your goals. Add or edit only to override its choices."
      >
        <form.AppField name="savedSearches" mode="array">
          {(field) => (
            <FieldRowList
              count={field.state.value?.length ?? 0}
              keys={searchList.keys}
              emptyText="None yet - the pilot will create them on its next quiet cycle."
              addLabel="Add search"
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
                          <sub.Select
                            label="Board"
                            items={domains.map((d) => ({ value: d, label: d }))}
                            optional
                            emptyLabel="Let the pilot choose"
                            helperText="Configured job board to search. Leave blank to let the pilot choose."
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
            </FieldRowList>
          )}
        </form.AppField>
      </FormSection>
    );
  },
});
