"use client";

import type { ReactElement } from "react";
import { type UserUpdateInput, userUpdateSchema } from "@jobpilot/contracts/user";
import { Box, Card, CardContent, LinearProgress, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { userQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { QueryError } from "@/components/ui/feedback";
import { useAppForm } from "@/components/ui/form/tanstack";
import { type SectionAnchor, SectionLayout } from "@/components/ui/layout";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useToast } from "@/providers/toast-provider";
import { AddressSection } from "./address-section";
import { EeoSection } from "./eeo-section";
import { PersonalSection } from "./personal-section";
import { toProfileFormValues } from "./profile-form-values";
import { ReferencesSection } from "./references-section";
import { SalarySection } from "./salary-section";
import { WorkAuthSection } from "./work-auth-section";

/** Who you are, or what the pilot answers on application forms. Both save the whole profile. */
type ProfilePage = "profile" | "answers";

const PROFILE_FIELDS = {
  firstName: true,
  lastName: true,
  contactEmail: true,
  phone: true,
  website: true,
  linkedin: true,
  github: true,
  street: true,
  aptUnit: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
} as const;

const PAGE_TITLES: Record<ProfilePage, string> = {
  profile: "Profile",
  answers: "Application answers",
};

/** Both pages save the whole profile, so an invalid field can sit on the page not shown. */
function invalidPages(value: UserUpdateInput): Set<ProfilePage> {
  const issues = userUpdateSchema.safeParse(value).error?.issues ?? [];
  return new Set(
    issues.map((issue) => (String(issue.path[0]) in PROFILE_FIELDS ? "profile" : "answers")),
  );
}

const ANSWER_ANCHORS: SectionAnchor[] = [
  { id: "work-auth", label: "Work authorization" },
  { id: "salary", label: "Salary" },
  { id: "references", label: "References" },
  { id: "eeo", label: "Equal opportunity" },
];

interface ProfileSettingsFormProps {
  page: ProfilePage;
}

export function ProfileSettingsForm(props: ProfileSettingsFormProps): ReactElement {
  const { page } = props;
  const query = useQuery(userQueries.detail());

  if (query.isLoading) {
    return <LinearProgress />;
  }
  if (!query.data) {
    return <QueryError title="Couldn't load your profile." onRetry={() => void query.refetch()} />;
  }

  return <SettingsForm initialData={toProfileFormValues(query.data)} page={page} />;
}

interface SettingsFormProps {
  initialData: UserUpdateInput;
  page: ProfilePage;
}

function SettingsForm(props: SettingsFormProps): ReactElement {
  const { initialData, page } = props;
  const toast = useToast();
  const save = useApiMutation((vars: UserUpdateInput) => api.user.put(vars), {
    successMessage: "Saved",
    invalidate: [userQueries.all],
    // The saved values become the new baseline, so the save bar and leave-page prompt clear.
    onSuccess: (_data, vars) => form.reset(vars),
  });

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: userUpdateSchema },
    onSubmitInvalid: ({ value }) => {
      const pages = invalidPages(value);
      const elsewhere = !pages.has(page) && pages.size > 0;
      const other = page === "profile" ? "answers" : "profile";
      toast.error(
        elsewhere
          ? `Fix the fields on the ${PAGE_TITLES[other]} page first`
          : "Fix the highlighted fields",
      );
    },
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
      {page === "profile" && (
        <Stack spacing={2}>
          <SettingsCard>
            <PersonalSection form={form} />
          </SettingsCard>
          <SettingsCard>
            <AddressSection form={form} />
          </SettingsCard>
        </Stack>
      )}
      {page === "answers" && (
        <SectionLayout anchors={ANSWER_ANCHORS} railSide="end">
          <Stack spacing={2}>
            <SettingsCard sectionId="work-auth">
              <WorkAuthSection form={form} />
            </SettingsCard>
            <SettingsCard sectionId="salary">
              <SalarySection form={form} />
            </SettingsCard>
            <SettingsCard sectionId="references">
              <ReferencesSection form={form} />
            </SettingsCard>
            <SettingsCard sectionId="eeo">
              <EeoSection form={form} />
            </SettingsCard>
          </Stack>
        </SectionLayout>
      )}
      <form.AppForm>
        <form.UnsavedChangesBar />
      </form.AppForm>
    </Box>
  );
}

interface SettingsCardProps {
  sectionId?: string;
  children: ReactElement;
}

/** The sections carry their own headings, since onboarding shows them without a card. */
function SettingsCard(props: SettingsCardProps): ReactElement {
  const { sectionId, children } = props;
  return (
    <Card data-section-id={sectionId}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
