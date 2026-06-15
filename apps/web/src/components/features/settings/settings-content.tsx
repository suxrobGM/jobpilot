"use client";

import { useState, type ReactElement } from "react";
import { Save } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack } from "@mui/material";
import { unwrap } from "@/api/client";
import { api } from "@/api/eden";
import {
  PROFILE_DEFAULT_VALUES,
  profileWithAutoApplySchema,
  type ProfileWithAutoApplyInput,
} from "@jobpilot/contracts/profile";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ProfileResponse } from "@/api/types";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionAnchorNav, type SectionAnchor } from "@/components/ui/layout/section-anchor-nav";
import { AddressSection } from "./sections/address-section";
import { AutoApplySection } from "./sections/auto-apply-section";
import { CredentialsSection } from "./sections/credentials-section";
import { EeoSection } from "./sections/eeo-section";
import { EmailSection } from "./sections/email-section";
import { PersonalSection } from "./sections/personal-section";
import { ReferencesSection } from "./sections/references-section";
import { WorkAuthSection } from "./sections/work-auth-section";

const ANCHORS: SectionAnchor[] = [
  { id: "personal", label: "Personal" },
  { id: "address", label: "Address" },
  { id: "work-auth", label: "Work auth" },
  { id: "references", label: "References" },
  { id: "eeo", label: "EEO" },
  { id: "auto-apply", label: "Auto-apply" },
  { id: "email", label: "Email" },
  { id: "credentials", label: "Credentials" },
];

export function SettingsContent(): ReactElement {
  const query = useApiQuery<ProfileResponse>(
    queryKeys.profile.detail(),
    () => unwrap(api.profile.get()),
    { errorMessage: "Failed to load profile" },
  );

  if (query.isLoading || !query.data) {
    return <LinearProgress />;
  }

  return <SettingsForm initialData={toFormValues(query.data)} />;
}

function toFormValues(data: ProfileResponse): ProfileWithAutoApplyInput {
  if (!data.profile) {
    return PROFILE_DEFAULT_VALUES;
  }
  const p = data.profile;
  const a = data.autoApply ?? PROFILE_DEFAULT_VALUES.autoApply!;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone ?? "",
    website: p.website ?? "",
    linkedin: p.linkedin ?? "",
    github: p.github ?? "",
    street: p.street ?? "",
    aptUnit: p.aptUnit ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zipCode: p.zipCode ?? "",
    country: p.country ?? "",
    usAuthorized: p.usAuthorized,
    requiresSponsorship: p.requiresSponsorship,
    visaStatus: p.visaStatus ?? "",
    optExtension: p.optExtension ?? "",
    willingToRelocate: p.willingToRelocate,
    preferredLocations: p.preferredLocations,
    references: p.references.map((r) => ({
      name: r.name,
      relationship: r.relationship ?? "",
      company: r.company ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
    })),
    eeoGender: p.eeoGender ?? "",
    eeoRace: p.eeoRace ?? "",
    eeoEthnicity: p.eeoEthnicity ?? "",
    eeoHispanicOrLatino: p.eeoHispanicOrLatino ?? "",
    eeoVeteranStatus: p.eeoVeteranStatus ?? "",
    eeoDisabilityStatus: p.eeoDisabilityStatus ?? "",
    primaryResumeId: p.primaryResumeId,
    autoApply: a,
  };
}

interface SettingsFormProps {
  initialData: ProfileWithAutoApplyInput;
}

function SettingsForm(props: SettingsFormProps): ReactElement {
  const { initialData } = props;
  const [, setDirty] = useState(false);

  const save = useApiMutation<{ id: number }, ProfileWithAutoApplyInput>(
    (vars) => unwrap(api.profile.put(vars)),
    {
      successMessage: "Settings saved",
      invalidate: [queryKeys.profile.all],
      onSuccess: () => setDirty(false),
    },
  );

  const form = useAppForm({
    defaultValues: initialData,
    validators: { onSubmit: profileWithAutoApplySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        gap: 3,
        alignItems: "flex-start",
      }}
    >
      <SectionAnchorNav anchors={ANCHORS} />

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        sx={{ flex: 1, minWidth: 0, width: "100%" }}
      >
        <Stack spacing={3}>
          <Box data-section-id="personal">
            <PersonalSection form={form} />
          </Box>
          <Box data-section-id="address">
            <AddressSection form={form} />
          </Box>
          <Box data-section-id="work-auth">
            <WorkAuthSection form={form} />
          </Box>
          <Box data-section-id="references">
            <ReferencesSection form={form} />
          </Box>
          <Box data-section-id="eeo">
            <EeoSection form={form} />
          </Box>
          <Box data-section-id="auto-apply">
            <AutoApplySection form={form} />
          </Box>
          <Box data-section-id="email">
            <EmailSection />
          </Box>
          <Box data-section-id="credentials">
            <CredentialsSection />
          </Box>

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
              disabled={save.isPending}
            >
              {save.isPending ? "Saving" : "Save settings"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
