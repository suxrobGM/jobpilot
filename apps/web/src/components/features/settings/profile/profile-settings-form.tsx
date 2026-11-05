"use client";

import type { ReactElement } from "react";
import { type UserWithAutoApplyInput, userWithAutoApplySchema } from "@jobpilot/contracts/user";
import { Save } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { userQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { QueryError } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { StickyFooter } from "@/components/ui/layout";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { AddressSection } from "./address-section";
import { AutoApplySection } from "./auto-apply-section";
import { EeoSection } from "./eeo-section";
import { PersonalSection } from "./personal-section";
import { toProfileFormValues } from "./profile-form-values";
import { ReferencesSection } from "./references-section";
import { SalarySection } from "./salary-section";
import { WorkAuthSection } from "./work-auth-section";

export function ProfileSettingsForm(): ReactElement {
  const query = useQuery(userQueries.detail());

  if (query.isLoading) {
    return <LinearProgress />;
  }
  if (!query.data) {
    return <QueryError title="Couldn't load your profile." onRetry={() => void query.refetch()} />;
  }

  return (
    <Stack spacing={3}>
      <SettingsForm initialData={toProfileFormValues(query.data)} />
    </Stack>
  );
}

interface SettingsFormProps {
  initialData: UserWithAutoApplyInput;
}

function SettingsForm(props: SettingsFormProps): ReactElement {
  const { initialData } = props;
  const save = useApiMutation((vars: UserWithAutoApplyInput) => api.user.put(vars), {
    successMessage: "Settings saved",
    invalidate: [userQueries.all],
    // The saved values become the new baseline, so the leave-page prompt clears.
    onSuccess: (_data, vars) => form.reset(vars),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: userWithAutoApplySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });
  const pristine = useSelector(form.store, (s) => s.isDefaultValue);
  useUnsavedChangesGuard(!pristine && !save.isPending);

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      sx={{ width: "100%" }}
    >
      <Stack spacing={3}>
        <PersonalSection form={form} />
        <AddressSection form={form} />
        <WorkAuthSection form={form} />
        <ReferencesSection form={form} />
        <SalarySection form={form} />
        <EeoSection form={form} />
        <AutoApplySection form={form} />

        <StickyFooter>
          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save fontSize="md" />}
              loading={save.isPending}
            >
              Save settings
            </Button>
          </Stack>
        </StickyFooter>
      </Stack>
    </Box>
  );
}
