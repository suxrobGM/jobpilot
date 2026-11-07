"use client";

import type { ReactElement } from "react";
import type { PilotState, UpdatePilotSettingsInput } from "@jobpilot/contracts/pilot";
import { Box, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { FormSection } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/toast-provider";
import { CheckIntervalSection } from "./check-interval-section";
import { settingsFormSchema, toFormValues, toSettings } from "./form-schema";
import { JobAlertsSetting } from "./job-alerts-setting";
import { NetworkingSection } from "./networking-section";
import { ResearchSection } from "./research-section";

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
  return <SettingsEditor state={stateQuery.data} />;
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
        title="How the pilot works"
        description="Optional - the defaults work for most people."
      >
        <Stack spacing={3}>
          <CheckIntervalSection form={form} />
          <JobAlertsSetting />
          <FormSection
            title="Research"
            description="Beyond your boards, the pilot searches the open web for postings that fit your goals - weekly, and sooner when searches run dry."
          >
            <ResearchSection />
          </FormSection>
          <NetworkingSection form={form} />
        </Stack>
      </SectionCard>

      <form.AppForm>
        <form.UnsavedChangesBar />
      </form.AppForm>
    </Box>
  );
}
