"use client";

import type { ReactElement } from "react";
import type { PilotInstructionsConfig, PilotState } from "@jobpilot/contracts/pilot";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useKeyedList } from "@/hooks/use-keyed-list";
import { InstructionsRowList } from "./instructions-row-list";

interface InstructionsEditorProps {
  state: PilotState;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const EMPTY_QUERY = { query: "", board: "", cadenceHours: 24 };

const EMPTY_VENUE = { venue: "", target: "", cadenceDays: 30 };

const instructionsFormSchema = z.object({
  goals: z.string(),
  dailyApplyCap: z.number().int().min(0),
  dailyOutreachCap: z.number().int().min(0),
  outreachFollowupDays: z.number().int().min(0),
  minScore: z.number().min(0).max(100),
  checkIntervalMinutes: z.number().int().min(1),
  activeHoursEnabled: z.boolean(),
  activeHoursStart: z.string().regex(HHMM, "Use HH:MM"),
  activeHoursEnd: z.string().regex(HHMM, "Use HH:MM"),
  activeHoursTz: z.string(),
  outreachEmail: z.enum(["draft", "review", "auto"]),
  outreachLinkedIn: z.enum(["draft", "review"]),
  standingQueries: z.array(
    z.object({
      query: z.string().min(1, "Required"),
      board: z.string(),
      cadenceHours: z.number().min(1),
    }),
  ),
  promotionVenues: z.array(
    z.object({
      venue: z.string().min(1, "Required"),
      target: z.string(),
      cadenceDays: z.number().min(1),
    }),
  ),
});

type InstructionsFormValues = z.infer<typeof instructionsFormSchema>;

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
    standingQueries: c.standingQueries.map((q) => ({
      query: q.query,
      board: q.board ?? "",
      cadenceHours: q.cadenceHours,
    })),
    promotionVenues: c.promotion.venues.map((v) => ({
      venue: v.venue,
      target: v.target ?? "",
      cadenceDays: v.cadenceDays,
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
        standingQueries: value.standingQueries.map((q) => ({
          query: q.query.trim(),
          board: q.board.trim() || undefined,
          cadenceHours: q.cadenceHours,
        })),
        autonomy: {
          outreachEmail: value.outreachEmail,
          outreachLinkedIn: value.outreachLinkedIn,
        },
        promotion: {
          venues: value.promotionVenues.map((v) => ({
            venue: v.venue.trim(),
            target: v.target.trim() || undefined,
            cadenceDays: v.cadenceDays,
          })),
          autonomy: "review",
        },
      };
      await save.mutateAsync({ goals: value.goals, config });
    },
  });

  const activeHoursEnabled = useSelector(form.store, (s) => s.values.activeHoursEnabled);
  const queryCount = useSelector(form.store, (s) => s.values.standingQueries.length);
  const queryList = useKeyedList(queryCount);
  const venueCount = useSelector(form.store, (s) => s.values.promotionVenues.length);
  const venueList = useKeyedList(venueCount);

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

          <FormSection title="Autonomy">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <form.AppField name="outreachEmail">
                  {(field) => (
                    <field.Select
                      label="Outreach email"
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
            title="Standing queries"
            description="Searches the pilot re-runs on its own cadence."
          >
            <form.AppField name="standingQueries" mode="array">
              {(field) => (
                <InstructionsRowList
                  count={field.state.value?.length ?? 0}
                  keys={queryList.keys}
                  emptyText="No standing queries yet."
                  addLabel="Add query"
                  removeAria={(i) => `Remove query ${i + 1}`}
                  // useKeyedList appends a key when the tracked length grows.
                  onAdd={() => field.pushValue({ ...EMPTY_QUERY })}
                  onRemove={(i) => {
                    queryList.onRemove(i);
                    field.removeValue(i);
                  }}
                >
                  {(i) => (
                    <>
                      <Box sx={{ flex: 2 }}>
                        <form.AppField name={`standingQueries[${i}].query`}>
                          {(sub) => <sub.TextField label="Query" />}
                        </form.AppField>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <form.AppField name={`standingQueries[${i}].board`}>
                          {(sub) => <sub.TextField label="Board (optional)" />}
                        </form.AppField>
                      </Box>
                      <Box sx={{ width: { xs: "100%", sm: 140 } }}>
                        <form.AppField name={`standingQueries[${i}].cadenceHours`}>
                          {(sub) => (
                            <sub.TextField
                              label="Cadence (h)"
                              type="number"
                              slotProps={{ htmlInput: { min: 1, step: 1 } }}
                            />
                          )}
                        </form.AppField>
                      </Box>
                    </>
                  )}
                </InstructionsRowList>
              )}
            </form.AppField>
          </FormSection>

          <FormSection
            title="Promotion venues"
            description="Where the pilot drafts self-promotion posts, and how often. Posts are review-only."
          >
            <Stack spacing={2}>
              <Typography variant="body2Muted">
                Autonomy: review each post before it goes out.
              </Typography>
              <form.AppField name="promotionVenues" mode="array">
                {(field) => (
                  <InstructionsRowList
                    count={field.state.value?.length ?? 0}
                    keys={venueList.keys}
                    emptyText="No promotion venues yet."
                    addLabel="Add venue"
                    removeAria={(i) => `Remove venue ${i + 1}`}
                    onAdd={() => field.pushValue({ ...EMPTY_VENUE })}
                    onRemove={(i) => {
                      venueList.onRemove(i);
                      field.removeValue(i);
                    }}
                  >
                    {(i) => (
                      <>
                        <Box sx={{ flex: 2 }}>
                          <form.AppField name={`promotionVenues[${i}].venue`}>
                            {(sub) => <sub.TextField label="Venue" />}
                          </form.AppField>
                        </Box>
                        <Box sx={{ flex: 2 }}>
                          <form.AppField name={`promotionVenues[${i}].target`}>
                            {(sub) => <sub.TextField label="Target (optional)" />}
                          </form.AppField>
                        </Box>
                        <Box sx={{ width: { xs: "100%", sm: 140 } }}>
                          <form.AppField name={`promotionVenues[${i}].cadenceDays`}>
                            {(sub) => (
                              <sub.TextField
                                label="Cadence (d)"
                                type="number"
                                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                              />
                            )}
                          </form.AppField>
                        </Box>
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
