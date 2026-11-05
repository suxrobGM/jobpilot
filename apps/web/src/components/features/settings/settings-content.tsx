"use client";

import { type ReactElement, useState } from "react";
import { type UserWithAutoApplyInput, userWithAutoApplySchema } from "@jobpilot/contracts/user";
import { Save } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { userQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useAppForm } from "@/components/ui/form/tanstack";
import { toProfileFormValues } from "./profile-form-values";
import { AddressSection } from "./sections/address-section";
import { AutoApplySection } from "./sections/auto-apply-section";
import { EeoSection } from "./sections/eeo-section";
import { PersonalSection } from "./sections/personal-section";
import { ReferencesSection } from "./sections/references-section";
import { SalarySection } from "./sections/salary-section";
import { SavedAnswersSection } from "./sections/saved-answers-section";
import { WorkAuthSection } from "./sections/work-auth-section";

export function SettingsContent(): ReactElement {
  const query = useApiQuery(userQueries.detail(), {
    errorMessage: "Failed to load profile",
  });

  if (query.isLoading || !query.data) {
    return <LinearProgress />;
  }

  return <SettingsForm initialData={toProfileFormValues(query.data)} />;
}

interface SettingsFormProps {
  initialData: UserWithAutoApplyInput;
}

function SettingsForm(props: SettingsFormProps): ReactElement {
  const { initialData } = props;
  const [, setDirty] = useState(false);

  const save = useApiMutation((vars: UserWithAutoApplyInput) => api.user.put(vars), {
    successMessage: "Settings saved",
    invalidate: [queryKeys.user.all],
    onSuccess: () => setDirty(false),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: userWithAutoApplySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

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
        <SavedAnswersSection />
        <ReferencesSection form={form} />
        <SalarySection form={form} />
        <EeoSection form={form} />
        <AutoApplySection form={form} />

        <Stack
          direction="row"
          sx={(theme) => ({
            position: "sticky",
            bottom: 0,
            justifyContent: "flex-end",
            paddingBlock: theme.spacing(1.5),
            backgroundColor: theme.palette.surfaces.base,
            borderTop: `1px solid ${theme.palette.line.divider}`,
            zIndex: 1,
          })}
        >
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save fontSize="md" />}
            loading={save.isPending}
          >
            Save settings
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
