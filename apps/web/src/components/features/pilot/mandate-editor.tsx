"use client";

import type { ReactElement } from "react";
import type { PilotMandateConfig, PilotState } from "@jobpilot/contracts/pilot";
import { Add, Delete } from "@mui/icons-material";
import { Box, Button, Grid, IconButton, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useKeyedList } from "@/hooks/use-keyed-list";

interface MandateEditorProps {
  state: PilotState;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const EMPTY_QUERY = { query: "", board: "", cadenceHours: 24 };

const mandateFormSchema = z.object({
  goals: z.string(),
  dailyApplyCap: z.number().int().min(0),
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
});

type MandateFormValues = z.infer<typeof mandateFormSchema>;

function toFormValues(state: PilotState): MandateFormValues {
  const c = state.mandateConfig;
  return {
    goals: state.mandateGoals,
    dailyApplyCap: c.dailyApplyCap,
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
  };
}

export function MandateEditor(props: MandateEditorProps): ReactElement {
  const { state } = props;

  const save = useApiMutation<unknown, { goals: string; config: PilotMandateConfig }>(
    (body) => api.pilot.mandate.put(body),
    { invalidate: [queryKeys.pilot.state()], successMessage: "Mandate saved." },
  );

  const form = useAppForm({
    defaultValues: toFormValues(state),
    validators: { onSubmit: mandateFormSchema },
    onSubmit: async ({ value }) => {
      const config: PilotMandateConfig = {
        dailyApplyCap: value.dailyApplyCap,
        minScore: value.minScore,
        checkIntervalMinutes: value.checkIntervalMinutes,
        // Boards aren't editable in M1 - preserve whatever the mandate already had.
        boards: state.mandateConfig.boards,
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
      };
      await save.mutateAsync({ goals: value.goals, config });
    },
  });

  const activeHoursEnabled = useSelector(form.store, (s) => s.values.activeHoursEnabled);
  const queryCount = useSelector(form.store, (s) => s.values.standingQueries.length);
  const { keys, onRemove } = useKeyedList(queryCount);

  return (
    <SectionCard title="Mandate">
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
              {(field) => {
                const rows = field.state.value ?? [];
                return (
                  <Stack spacing={2}>
                    {rows.map((_, i) => (
                      <Stack key={keys[i]} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
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
                        <IconButton
                          aria-label={`Remove query ${i + 1}`}
                          size="small"
                          sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
                          onClick={() => {
                            onRemove(i);
                            field.removeValue(i);
                          }}
                        >
                          <Delete fontSize="sm" />
                        </IconButton>
                      </Stack>
                    ))}
                    {rows.length === 0 && (
                      <Typography variant="body2Muted">No standing queries yet.</Typography>
                    )}
                    <Box>
                      <Button
                        variant="outlined"
                        startIcon={<Add fontSize="sm" />}
                        onClick={() => {
                          // useKeyedList appends a key when the tracked length grows.
                          field.pushValue({ ...EMPTY_QUERY });
                        }}
                      >
                        Add query
                      </Button>
                    </Box>
                  </Stack>
                );
              }}
            </form.AppField>
          </FormSection>

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canSubmit || isSubmitting || save.isPending}
                >
                  Save mandate
                </Button>
              )}
            </form.Subscribe>
          </Stack>
        </Stack>
      </form>
    </SectionCard>
  );
}
