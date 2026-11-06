"use client";

import type { ReactElement } from "react";
import type { PilotState, UpdatePilotSettingsInput } from "@jobpilot/contracts/pilot";
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
import { CheckIntervalSection } from "./check-interval-section";
import { settingsFormSchema, toFormValues, toSettings } from "./form-schema";
import { JobAlertsSetting } from "./job-alerts-setting";
import { NetworkingSection } from "./networking-section";
import { PlatformsSection } from "./platforms-section";
import { ResearchSection } from "./research-section";

const ANCHORS: SectionAnchor[] = [
  { id: "schedule", label: "Schedule" },
  { id: "job-alerts", label: "Job alerts" },
  { id: "research", label: "Research" },
  { id: "networking", label: "Networking" },
  { id: "boards", label: "Boards" },
  { id: "platforms", label: "Platforms" },
];

export function PilotSettingsForm(): ReactElement {
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
    <SectionLayout anchors={ANCHORS}>
      <SettingsEditor state={stateQuery.data} />
    </SectionLayout>
  );
}

interface SettingsEditorProps {
  state: PilotState;
}

function SettingsEditor(props: SettingsEditorProps): ReactElement {
  const { state } = props;
  const toast = useToast();

  const save = useApiMutation((body: UpdatePilotSettingsInput) => api.pilot.settings.patch(body), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: "Saved.",
  });

  const form = useAppForm({
    defaultValues: toFormValues(state),
    validators: { onSubmit: settingsFormSchema },
    onSubmitInvalid: () => toast.error("Fix the highlighted fields"),
    onSubmit: async ({ value }) => {
      await save.mutateAsync(toSettings(value));
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
      <SectionCard
        title="Pilot settings"
        description="Optional - the defaults work for most people."
      >
        <Stack spacing={3}>
          <Box data-section-id="schedule">
            <CheckIntervalSection form={form} />
          </Box>
          <Box data-section-id="job-alerts">
            <JobAlertsSetting />
          </Box>
          <Box data-section-id="research">
            <FormSection
              title="Research"
              description="Beyond your boards, the pilot searches the open web for postings that fit your goals - weekly, and sooner when searches run dry."
            >
              <ResearchSection />
            </FormSection>
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

      {showSaveBar && (
        <StickyFooter>
          <Stack
            direction="row"
            spacing={2}
            sx={{ justifyContent: "flex-end", alignItems: "center" }}
          >
            <Typography variant="captionMuted">Unsaved changes</Typography>
            <form.AppForm>
              <form.SubmitButton>Save settings</form.SubmitButton>
            </form.AppForm>
          </Stack>
        </StickyFooter>
      )}
    </Box>
  );
}
