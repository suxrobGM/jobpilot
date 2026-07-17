"use client";

import { Grid, InputAdornment, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { FormSection } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { FieldInfo } from "./field-info";
import { INSTRUCTIONS_FORM_DEFAULTS } from "./form-schema";
import { InstructionsRowList } from "./row-list";

const EMPTY_PLATFORM = { platform: "", target: "", cadenceDays: 30 };

export const PlatformsSection = withForm({
  defaultValues: INSTRUCTIONS_FORM_DEFAULTS,
  render: function PlatformsSection({ form }) {
    const platformCount = useSelector(form.store, (s) => s.values.promotionPlatforms.length);
    const platformList = useKeyedList(platformCount);

    return (
      <FormSection
        title="Platforms"
        description="Where the pilot drafts self-promotion posts, and how often. Every post is review-only."
      >
        <Stack spacing={2}>
          <Typography variant="body2Muted">
            Autonomy: review each post before it goes out.
          </Typography>
          <form.AppField name="promotionPlatforms" mode="array">
            {(field) => (
              <InstructionsRowList
                count={field.state.value?.length ?? 0}
                keys={platformList.keys}
                emptyText="No platforms yet."
                addLabel="Add platform"
                removeAria={(i) => `Remove platform ${i + 1}`}
                rowLabel={(i) => `Platform ${i + 1}`}
                onAdd={() => field.pushValue({ ...EMPTY_PLATFORM })}
                onRemove={(i) => {
                  platformList.onRemove(i);
                  field.removeValue(i);
                }}
              >
                {(i) => (
                  <>
                    <form.AppField name={`promotionPlatforms[${i}].platform`}>
                      {(sub) => (
                        <sub.TextField
                          label="Platform"
                          placeholder="hn-whoishiring, linkedin-post, reddit:forhire"
                          helperText="Where the pilot drafts a promo post."
                          slotProps={{
                            input: {
                              endAdornment: (
                                <FieldInfo title="Where to post: hn-whoishiring, linkedin-post, or reddit:<subreddit>." />
                              ),
                            },
                          }}
                        />
                      )}
                    </form.AppField>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 7 }}>
                        <form.AppField name={`promotionPlatforms[${i}].target`}>
                          {(sub) => (
                            <sub.TextField
                              label="Target"
                              placeholder="thread URL or subreddit"
                              helperText="Specific thread, subreddit, or URL (optional)."
                            />
                          )}
                        </form.AppField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <form.AppField name={`promotionPlatforms[${i}].cadenceDays`}>
                          {(sub) => (
                            <sub.TextField
                              label="Draft every"
                              type="number"
                              helperText="How often to draft a new post."
                              slotProps={{
                                htmlInput: { min: 1, step: 1 },
                                input: {
                                  endAdornment: (
                                    <InputAdornment position="end">days</InputAdornment>
                                  ),
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
        </Stack>
      </FormSection>
    );
  },
});
