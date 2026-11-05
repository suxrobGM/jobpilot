"use client";

import { type ReactElement, useState } from "react";
import {
  NO_INSTRUCTIONS_CHANGE,
  type PilotInstructionsChange,
  type PilotState,
  type UpdatePilotInstructionsInput,
} from "@jobpilot/contracts/pilot";
import { Box, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import {
  type SectionAnchor,
  SectionCard,
  SectionLayout,
  StickyFooter,
} from "@/components/ui/layout";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/toast-provider";
import { BoardsSection } from "./boards-section";
import {
  type InstructionsFormValues,
  instructionsFormSchema,
  toConfig,
  toFormValues,
} from "./form-schema";
import { GoalsChangeDialog } from "./goals-change-dialog";
import { GoalsSection } from "./goals-section";
import { LimitsSection } from "./limits-section";
import { NetworkingSection } from "./networking-section";
import { PlatformsSection } from "./platforms-section";
import { ResearchSection } from "./research-section";
import { SearchesList } from "./searches-list";

const NAV_ANCHORS: SectionAnchor[] = [
  { id: "goals", label: "Goals" },
  { id: "searches", label: "Searches" },
  { id: "research", label: "Research" },
  { id: "limits", label: "Limits" },
  { id: "networking", label: "Networking" },
  { id: "boards", label: "Boards" },
  { id: "platforms", label: "Platforms" },
];

export function InstructionsTab(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());

  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[480]} />;
  }
  if (!stateQuery.data) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }
  // The form takes its defaults once, so it mounts only after the state has loaded.
  return (
    <SectionLayout anchors={NAV_ANCHORS}>
      <InstructionsEditor state={stateQuery.data} />
    </SectionLayout>
  );
}

interface InstructionsEditorProps {
  state: PilotState;
}

function InstructionsEditor(props: InstructionsEditorProps): ReactElement {
  const { state } = props;
  const toast = useToast();

  const save = useApiMutation(
    (body: UpdatePilotInstructionsInput) => api.pilot.instructions.put(body),
    {
      invalidate: [pilotQueries.state().queryKey, pilotQueries.searches().queryKey],
      successMessage: "Instructions saved.",
    },
  );

  // Fetched on submit: a mount fetch still loading reads as "nothing in flight" and skips the ask.
  const impact = useQuery({ ...pilotQueries.instructionsImpact(), enabled: false });

  // Set while the goals-changed dialog is open; carries the values the save finishes with.
  const [pending, setPending] = useState<InstructionsFormValues | null>(null);

  const commit = async (value: InstructionsFormValues, onChange: PilotInstructionsChange) => {
    await save.mutateAsync({
      goals: value.goals,
      config: toConfig(value),
      onChange,
    });
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
      if (value.goals !== state.instructionsGoals) {
        // A failed check must not silently keep the old plan, so only a confirmed empty one skips.
        const { data, isError } = await impact.refetch();
        const inFlight = data
          ? data.searches.length + data.campaigns.length + data.approvedJobs
          : 0;
        if (isError || inFlight > 0) {
          setPending(value);
          return;
        }
      }
      await commit(value, NO_INSTRUCTIONS_CHANGE);
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
      <Stack spacing={3}>
        <SectionCard
          title="Instructions"
          description="Goals are all the pilot needs - it creates and maintains its saved searches from them."
        >
          <Stack spacing={3}>
            <Box data-section-id="goals">
              <GoalsSection form={form} />
            </Box>
            {/* Server data the pilot owns, not form state. */}
            <Box data-section-id="searches">
              <FormSection
                title="Searches"
                description="The pilot creates and maintains these from your goals - shown read-only."
              >
                <SearchesList />
              </FormSection>
            </Box>
            <Box data-section-id="research">
              <FormSection
                title="Research"
                description="Beyond your boards, the pilot searches the open web for postings that fit your goals - weekly, and sooner when searches run dry."
              >
                <ResearchSection />
              </FormSection>
            </Box>
          </Stack>
        </SectionCard>

        <SectionCard
          title="Tuning"
          description="Optional - caps, networking, boards and platforms. The defaults work for most people."
        >
          <Stack spacing={3}>
            <Box data-section-id="limits">
              <LimitsSection form={form} />
            </Box>
            <Box data-section-id="networking">
              <NetworkingSection form={form} />
            </Box>
            <Box data-section-id="boards">
              <BoardsSection form={form} />
            </Box>
            <Box data-section-id="platforms">
              <PlatformsSection form={form} />
            </Box>
          </Stack>
        </SectionCard>
      </Stack>

      {showSaveBar && (
        <StickyFooter>
          <Stack
            direction="row"
            spacing={2}
            sx={{ justifyContent: "flex-end", alignItems: "center" }}
          >
            <Typography variant="captionMuted">Unsaved changes</Typography>
            <form.AppForm>
              <form.SubmitButton>Save instructions</form.SubmitButton>
            </form.AppForm>
          </Stack>
        </StickyFooter>
      )}

      <GoalsChangeDialog
        open={pending !== null}
        impact={impact.data ?? null}
        isLoading={impact.isLoading}
        saving={save.isPending}
        onConfirm={(change) => {
          if (pending) {
            void commit(pending, change);
          }
        }}
        onCancel={() => setPending(null)}
      />
    </Box>
  );
}
