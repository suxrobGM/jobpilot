"use client";

import type { ReactElement } from "react";
import type { PilotInstructionsConfig, PilotState } from "@jobpilot/contracts/pilot";
import { Box, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { type SectionAnchor, SectionAnchorNav } from "@/components/ui/layout/section-anchor-nav";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/notification-provider";
import { ActiveHoursSection } from "./active-hours-section";
import { BoardsSection } from "./boards-section";
import { type InstructionsFormValues, instructionsFormSchema } from "./form-schema";
import { GoalsSection } from "./goals-section";
import { LimitsSection } from "./limits-section";
import { OutreachSection } from "./outreach-section";
import { PlatformsSection } from "./platforms-section";
import { SearchesSection } from "./searches-section";

interface InstructionsEditorProps {
  state: PilotState;
}

/** Drives both the anchor nav and the rendered order - one list, so an id can't drift from its section. */
const SECTIONS: (SectionAnchor & { Section: typeof GoalsSection })[] = [
  { id: "goals", label: "Goals", Section: GoalsSection },
  { id: "limits", label: "Operating limits", Section: LimitsSection },
  { id: "active-hours", label: "Active hours", Section: ActiveHoursSection },
  { id: "outreach", label: "Outreach", Section: OutreachSection },
  { id: "boards", label: "Boards", Section: BoardsSection },
  { id: "searches", label: "Saved searches", Section: SearchesSection },
  { id: "platforms", label: "Platforms", Section: PlatformsSection },
];

function toFormValues(state: PilotState): InstructionsFormValues {
  const c = state.instructionsConfig;
  return {
    goals: state.instructionsGoals,
    dailyApplyCap: c.dailyApplyCap,
    dailyOutreachCap: c.dailyOutreachCap,
    outreachFollowupDays: c.outreachFollowupDays,
    minScore: c.minScore,
    checkIntervalMinutes: c.checkIntervalMinutes,
    outreachEnabled: c.outreachEnabled,
    activeHoursEnabled: Boolean(c.activeHours),
    activeHoursStart: c.activeHours?.start ?? "09:00",
    activeHoursEnd: c.activeHours?.end ?? "17:00",
    activeHoursTz: c.activeHours?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    outreachEmail: c.autonomy.outreachEmail,
    outreachLinkedIn: c.autonomy.outreachLinkedIn,
    boards: [...c.boards],
    parkedBoards: [...c.parkedBoards],
    savedSearches: c.savedSearches.map((q) => ({
      query: q.query,
      board: q.board ?? "",
      cadenceHours: q.cadenceHours,
      resumeId: q.resumeId,
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
  const toast = useToast();

  const save = useApiMutation<unknown, { goals: string; config: PilotInstructionsConfig }>(
    (body) => api.pilot.instructions.put(body),
    { invalidate: [queryKeys.pilot.state()], successMessage: "Instructions saved." },
  );

  const form = useAppForm({
    defaultValues: toFormValues(state),
    validators: { onSubmit: instructionsFormSchema },
    onSubmitInvalid: () => toast.error("Fix the highlighted fields"),
    onSubmit: async ({ value }) => {
      const config: PilotInstructionsConfig = {
        dailyApplyCap: value.dailyApplyCap,
        dailyOutreachCap: value.dailyOutreachCap,
        outreachFollowupDays: value.outreachFollowupDays,
        minScore: value.minScore,
        checkIntervalMinutes: value.checkIntervalMinutes,
        outreachEnabled: value.outreachEnabled,
        boards: value.boards,
        parkedBoards: value.parkedBoards,
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
          resumeId: q.resumeId || undefined,
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
      // Re-baseline the defaults so the dirty save bar hides after a successful save.
      form.reset(value);
    },
  });

  // isDefaultValue tracks the (re-baselined) defaults; isDirty latches once touched.
  const pristine = useSelector(form.store, (s) => s.isDefaultValue);
  const showSaveBar = !pristine || save.isPending;
  useUnsavedChangesGuard(!pristine && !save.isPending);

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <SectionCard title="Instructions">
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            gap: { xs: 2, sm: 3 },
            alignItems: "flex-start",
          }}
        >
          <SectionAnchorNav anchors={SECTIONS} />

          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <Stack spacing={3}>
              {SECTIONS.map(({ id, Section }) => (
                <Box key={id} data-section-id={id}>
                  <Section form={form} />
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </SectionCard>

      {/* Outside the SectionCard: MUI Card clips overflow, which would break position: sticky. */}
      {showSaveBar && (
        <Stack
          direction="row"
          spacing={2}
          sx={(theme) => ({
            position: "sticky",
            bottom: 0,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBlock: theme.spacing(1.5),
            backgroundColor: theme.palette.surfaces.base,
            borderTop: `1px solid ${theme.palette.line.divider}`,
            zIndex: 1,
          })}
        >
          <Typography variant="captionMuted">Unsaved changes</Typography>
          <form.AppForm>
            <form.SubmitButton disabled={save.isPending}>
              {save.isPending ? "Saving" : "Save instructions"}
            </form.SubmitButton>
          </form.AppForm>
        </Stack>
      )}
    </Box>
  );
}
