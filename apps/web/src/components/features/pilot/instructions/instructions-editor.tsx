"use client";

import { type ReactElement, useState } from "react";
import {
  NO_INSTRUCTIONS_CHANGE,
  type PilotInstructionsChange,
  type PilotInstructionsConfig,
  type PilotState,
  pilotInstructionsConfigSchema,
  type UpdatePilotInstructionsInput,
} from "@jobpilot/contracts/pilot";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { type SectionAnchor, SectionAnchorNav } from "@/components/ui/layout/section-anchor-nav";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/notification-provider";
import { BoardsSection } from "./boards-section";
import { type InstructionsFormValues, instructionsFormSchema } from "./form-schema";
import { GoalsChangeDialog } from "./goals-change-dialog";
import { GoalsSection } from "./goals-section";
import { LimitsSection } from "./limits-section";
import { NetworkingSection } from "./networking-section";
import { PlatformsSection } from "./platforms-section";
import { SearchesList } from "./searches-list";

interface InstructionsEditorProps {
  state: PilotState;
}

/** Everything below Goals is optional tuning, collapsed behind one Advanced accordion. */
const ADVANCED_SECTIONS: { id: string; Section: typeof GoalsSection }[] = [
  { id: "limits", Section: LimitsSection },
  { id: "networking", Section: NetworkingSection },
  { id: "boards", Section: BoardsSection },
  { id: "platforms", Section: PlatformsSection },
];

const NAV_ANCHORS: SectionAnchor[] = [
  { id: "goals", label: "Goals" },
  { id: "searches", label: "Searches" },
  { id: "advanced", label: "Advanced settings" },
];

/** A config indistinguishable from `{}` means the user never tuned anything - keep Advanced folded. */
const DEFAULT_CONFIG_JSON = JSON.stringify(pilotInstructionsConfigSchema.parse({}));

function toConfig(value: InstructionsFormValues): PilotInstructionsConfig {
  return {
    dailyApplyCap: value.dailyApplyCap,
    minScore: value.minScore,
    checkIntervalMinutes: value.checkIntervalMinutes,
    boards: value.boards,
    networking: value.networking,
    promotion: {
      platforms: value.promotionPlatforms.map((p) => ({
        platform: p.platform.trim(),
        target: p.target.trim() || undefined,
        postEveryDays: p.postEveryDays,
      })),
      autonomy: "review",
    },
  };
}

function toFormValues(state: PilotState): InstructionsFormValues {
  const c = state.instructionsConfig;
  return {
    goals: state.instructionsGoals,
    dailyApplyCap: c.dailyApplyCap,
    minScore: c.minScore,
    checkIntervalMinutes: c.checkIntervalMinutes,
    networking: { ...c.networking },
    boards: [...c.boards],
    promotionPlatforms: c.promotion.platforms.map((p) => ({
      platform: p.platform,
      target: p.target ?? "",
      postEveryDays: p.postEveryDays,
    })),
  };
}

export function InstructionsEditor(props: InstructionsEditorProps): ReactElement {
  const { state } = props;
  const toast = useToast();
  // Expanded when any advanced value was ever customized, so tuning stays visible to its owner.
  const [advancedOpen, setAdvancedOpen] = useState(
    () => JSON.stringify(state.instructionsConfig) !== DEFAULT_CONFIG_JSON,
  );

  const save = useApiMutation<unknown, UpdatePilotInstructionsInput>(
    (body) => api.pilot.instructions.put(body),
    {
      invalidate: [queryKeys.pilot.state(), queryKeys.pilot.searches()],
      successMessage: "Instructions saved.",
    },
  );

  // Fetched on submit, not on mount: a mount fetch still in flight reads as "nothing in flight"
  // and saves changed goals without ever asking, which is the case the dialog exists for.
  const impact = useApiQuery(pilotQueries.instructionsImpact(), {
    enabled: false,
    errorMessage: "Failed to check what the pilot has in flight",
  });

  // Held between "the goals changed" and the user answering what to retire. Its presence opens the
  // dialog, and it carries the values the save finishes with.
  const [pending, setPending] = useState<InstructionsFormValues | null>(null);

  const commit = async (value: InstructionsFormValues, onChange: PilotInstructionsChange) => {
    await save.mutateAsync({ goals: value.goals, config: toConfig(value), onChange });
    setPending(null);
    // Re-baseline the defaults so the dirty save bar hides after a successful save.
    form.reset(value);
  };

  const form = useAppForm({
    defaultValues: toFormValues(state),
    validators: { onSubmit: instructionsFormSchema },
    onSubmitInvalid: () => toast.error("Fix the highlighted fields"),
    onSubmit: async ({ value }) => {
      // Only rewritten goals strand work - every config field is read live off the instructions.
      if (value.goals === state.instructionsGoals) {
        await commit(value, NO_INSTRUCTIONS_CHANGE);
        return;
      }

      // A failed check must not silently keep the old plan, so only a confirmed empty one skips.
      const { data, isError } = await impact.refetch();
      const inFlight = data ? data.searches.length + data.campaigns.length + data.approvedJobs : 0;
      if (!isError && inFlight === 0) {
        await commit(value, NO_INSTRUCTIONS_CHANGE);
        return;
      }
      setPending(value);
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
      <SectionCard
        title="Instructions"
        description="Goals are all the pilot needs - it creates and maintains its saved searches from them. Everything below is optional tuning."
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            gap: { xs: 2, sm: 3 },
            alignItems: "flex-start",
          }}
        >
          <SectionAnchorNav anchors={NAV_ANCHORS} />

          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <Stack spacing={3}>
              <Box data-section-id="goals">
                <GoalsSection form={form} />
              </Box>

              {/* Server data, not form state: the pilot owns these, so they render outside the form. */}
              <Box data-section-id="searches">
                <FormSection
                  title="Searches"
                  description="The pilot creates and maintains these from your goals - shown read-only."
                >
                  <SearchesList />
                </FormSection>
              </Box>

              <Box data-section-id="advanced">
                <Accordion
                  expanded={advancedOpen}
                  onChange={(_, open) => setAdvancedOpen(open)}
                  sx={(theme) => ({ borderColor: theme.palette.line.divider })}
                >
                  <AccordionSummary>
                    <Stack spacing={0.25}>
                      <Typography variant="body1Strong">Advanced settings</Typography>
                      <Typography variant="captionMuted">
                        Caps, networking, boards, platforms - the defaults work for most people.
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={3}>
                      {ADVANCED_SECTIONS.map(({ id, Section }) => (
                        <Box key={id} data-section-id={id}>
                          <Section form={form} />
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Box>
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

      <GoalsChangeDialog
        open={pending !== null}
        impact={impact.data}
        isLoading={impact.isLoading}
        saving={save.isPending}
        onConfirm={(change) => {
          if (pending) void commit(pending, change);
        }}
        onCancel={() => setPending(null)}
      />
    </Box>
  );
}
