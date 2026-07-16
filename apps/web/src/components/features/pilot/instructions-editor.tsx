"use client";

import type { ReactElement } from "react";
import type { PilotInstructionsConfig, PilotState } from "@jobpilot/contracts/pilot";
import { InfoOutlined } from "@mui/icons-material";
import { Grid, InputAdornment, Stack, Tooltip, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { type InstructionsFormValues, instructionsFormSchema } from "./instructions-form-schema";
import { InstructionsRowList } from "./instructions-row-list";

interface InstructionsEditorProps {
  state: PilotState;
}

const EMPTY_SEARCH = { query: "", board: "", cadenceHours: 24 };

const EMPTY_PLATFORM = { platform: "", target: "", cadenceDays: 30 };

function FieldInfo({ title }: { title: string }): ReactElement {
  return (
    <InputAdornment position="end">
      <Tooltip title={title}>
        <InfoOutlined fontSize="sm" sx={{ color: "text.secondary", cursor: "help" }} />
      </Tooltip>
    </InputAdornment>
  );
}

function toFormValues(state: PilotState): InstructionsFormValues {
  const c = state.instructionsConfig;
  return {
    goals: state.instructionsGoals,
    dailyApplyCap: c.dailyApplyCap,
    dailyOutreachCap: c.dailyOutreachCap,
    outreachFollowupDays: c.outreachFollowupDays,
    minScore: c.minScore,
    checkIntervalMinutes: c.checkIntervalMinutes,
    activeHoursEnabled: Boolean(c.activeHours),
    activeHoursStart: c.activeHours?.start ?? "09:00",
    activeHoursEnd: c.activeHours?.end ?? "17:00",
    activeHoursTz: c.activeHours?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    outreachEmail: c.autonomy.outreachEmail,
    outreachLinkedIn: c.autonomy.outreachLinkedIn,
    savedSearches: c.savedSearches.map((q) => ({
      query: q.query,
      board: q.board ?? "",
      cadenceHours: q.cadenceHours,
    })),
    promotionPlatforms: c.promotion.platforms.map((p) => ({
      platform: p.platform,
      target: p.target ?? "",
      cadenceDays: p.cadenceDays,
    })),
  };
}

export function InstructionsEditor(props: InstructionsEditorProps): ReactElement {
  const { state } = props;

  const save = useApiMutation<unknown, { goals: string; config: PilotInstructionsConfig }>(
    (body) => api.pilot.instructions.put(body),
    { invalidate: [queryKeys.pilot.state()], successMessage: "Instructions saved." },
  );

  const form = useAppForm({
    defaultValues: toFormValues(state),
    validators: { onSubmit: instructionsFormSchema },
    onSubmit: async ({ value }) => {
      const config: PilotInstructionsConfig = {
        dailyApplyCap: value.dailyApplyCap,
        dailyOutreachCap: value.dailyOutreachCap,
        outreachFollowupDays: value.outreachFollowupDays,
        minScore: value.minScore,
        checkIntervalMinutes: value.checkIntervalMinutes,
        // Boards/parked boards aren't editable here - preserve whatever the instructions already had
        // (parkedBoards is written by the board-health question flow).
        boards: state.instructionsConfig.boards,
        parkedBoards: state.instructionsConfig.parkedBoards,
        activeHours: value.activeHoursEnabled
          ? {
              start: value.activeHoursStart,
              end: value.activeHoursEnd,
              tz: value.activeHoursTz,
            }
          : undefined,
        savedSearches: value.savedSearches.map((q) => ({
          query: q.query.trim(),
          board: q.board.trim() || undefined,
          cadenceHours: q.cadenceHours,
        })),
        autonomy: {
          outreachEmail: value.outreachEmail,
          outreachLinkedIn: value.outreachLinkedIn,
        },
        promotion: {
          platforms: value.promotionPlatforms.map((p) => ({
            platform: p.platform.trim(),
            target: p.target.trim() || undefined,
            cadenceDays: p.cadenceDays,
          })),
          autonomy: "review",
        },
      };
      await save.mutateAsync({ goals: value.goals, config });
    },
  });

  const activeHoursEnabled = useSelector(form.store, (s) => s.values.activeHoursEnabled);
  const searchCount = useSelector(form.store, (s) => s.values.savedSearches.length);
  const searchList = useKeyedList(searchCount);
  const platformCount = useSelector(form.store, (s) => s.values.promotionPlatforms.length);
  const platformList = useKeyedList(platformCount);

  return (
    <SectionCard title="Instructions">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={3}>
          <form.AppField name="goals">
            {(field) => (
              <field.TextField
                label="Goals"
                multiline
                minRows={3}
                helperText="Plain-language direction for the pilot: roles, priorities, constraints."
              />
            )}
          </form.AppField>

          <FormSection title="Operating limits">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="dailyApplyCap">
                  {(field) => (
                    <field.TextField
                      label="Daily apply cap"
                      type="number"
                      helperText="Max jobs applied per day."
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="dailyOutreachCap">
                  {(field) => (
                    <field.TextField
                      label="Daily outreach cap"
                      type="number"
                      helperText="Max outreach messages per day."
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="outreachFollowupDays">
                  {(field) => (
                    <field.TextField
                      label="Outreach follow-up (days)"
                      type="number"
                      helperText="Days to wait before following up."
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="minScore">
                  {(field) => (
                    <field.TextField
                      label="Min score"
                      type="number"
                      helperText="Only apply to matches at or above this (0–100)."
                      slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <form.AppField name="checkIntervalMinutes">
                  {(field) => (
                    <field.TextField
                      label="Check interval (min)"
                      type="number"
                      helperText="How often the pilot wakes to work."
                      slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    />
                  )}
                </form.AppField>
              </Grid>
            </Grid>
          </FormSection>

          <FormSection
            title="Active hours"
            description="Restrict cycles to a window, or leave off to run around the clock."
          >
            <Stack spacing={2}>
              <form.AppField name="activeHoursEnabled">
                {(field) => <field.Switch label="Restrict to active hours" />}
              </form.AppField>
              {activeHoursEnabled && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <form.AppField name="activeHoursStart">
                      {(field) => <field.TextField label="Start (HH:MM)" placeholder="09:00" />}
                    </form.AppField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <form.AppField name="activeHoursEnd">
                      {(field) => <field.TextField label="End (HH:MM)" placeholder="17:00" />}
                    </form.AppField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <form.AppField name="activeHoursTz">
                      {(field) => <field.TextField label="Time zone" />}
                    </form.AppField>
                  </Grid>
                </Grid>
              )}
            </Stack>
          </FormSection>

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
                                    endAdornment: (
                                      <InputAdornment position="end">hours</InputAdornment>
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
          </FormSection>

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

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <form.AppForm>
              <form.SubmitButton disabled={save.isPending}>Save instructions</form.SubmitButton>
            </form.AppForm>
          </Stack>
        </Stack>
      </form>
    </SectionCard>
  );
}
