"use client";

import type { ReactElement } from "react";
import type { PilotState, UpdatePilotSettingsInput } from "@jobpilot/contracts/pilot";
import { Box, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/toast-provider";
import { PilotStateLoader } from "../../pilot/state/pilot-state-loader";
import { SettingsCard } from "../settings-card";
import { settingsFormSchema, toFormValues, toSettings } from "./form-schema";
import { NetworkingSection } from "./networking-section";
import { ScheduleSection } from "./schedule-section";

export function PilotSettingsForm(): ReactElement {
  // The form takes its defaults once, so it mounts only after the state has loaded.
  return (
    <PilotStateLoader heights={[480]}>
      {(state) => <SettingsEditor state={state} />}
    </PilotStateLoader>
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
  useUnsavedChangesGuard(!pristine && !save.isPending);

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack spacing={2}>
        <SettingsCard>
          <ScheduleSection form={form} />
        </SettingsCard>
        <SettingsCard>
          <NetworkingSection form={form} />
        </SettingsCard>
      </Stack>

      <form.AppForm>
        <form.UnsavedChangesBar />
      </form.AppForm>
    </Box>
  );
}
