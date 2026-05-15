"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Save } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack } from "@mui/material";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import type { AnyReactForm } from "@/components/ui/form/types";
import { SectionAnchorNav, type SectionAnchor } from "@/components/ui/layout/section-anchor-nav";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  PROFILE_DEFAULT_VALUES,
  profileWithAutopilotSchema,
  type ProfileWithAutopilotInput,
} from "@/lib/schemas/profile";
import type { ProfileResponse } from "@/types/api";
import { AddressSection } from "./sections/address-section";
import { AutopilotSection } from "./sections/autopilot-section";
import { CredentialsSection } from "./sections/credentials-section";
import { EeoSection } from "./sections/eeo-section";
import { EmailSection } from "./sections/email-section";
import { PersonalSection } from "./sections/personal-section";
import { WorkAuthSection } from "./sections/work-auth-section";

const ANCHORS: SectionAnchor[] = [
  { id: "personal", label: "Personal" },
  { id: "address", label: "Address" },
  { id: "work-auth", label: "Work auth" },
  { id: "eeo", label: "EEO" },
  { id: "autopilot", label: "Autopilot" },
  { id: "email", label: "Email" },
  { id: "credentials", label: "Credentials" },
];

export function SettingsContent(): ReactElement {
  const router = useRouter();
  const query = useApiQuery<ProfileResponse>(
    queryKeys.profile.detail(),
    () => apiClient.get<ProfileResponse>("/api/profile"),
    { errorMessage: "Failed to load profile" },
  );

  useEffect(() => {
    if (query.data && query.data.profile === null) {
      router.replace("/onboarding");
    }
  }, [query.data, router]);

  if (query.isLoading || !query.data || query.data.profile === null) {
    return <LinearProgress />;
  }

  return <SettingsForm initialData={toFormValues(query.data)} />;
}

function toFormValues(data: ProfileResponse): ProfileWithAutopilotInput {
  const p = data.profile!;
  const a = data.autopilot ?? PROFILE_DEFAULT_VALUES.autopilot!;
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
    eeoGender: p.eeoGender ?? "",
    eeoRace: p.eeoRace ?? "",
    eeoEthnicity: p.eeoEthnicity ?? "",
    eeoHispanicOrLatino: p.eeoHispanicOrLatino ?? "",
    eeoVeteranStatus: p.eeoVeteranStatus ?? "",
    eeoDisabilityStatus: p.eeoDisabilityStatus ?? "",
    primaryResumeId: p.primaryResumeId,
    autopilot: a,
  };
}

interface SettingsFormProps {
  initialData: ProfileWithAutopilotInput;
}

function SettingsForm(props: SettingsFormProps): ReactElement {
  const { initialData } = props;
  const [, setDirty] = useState(false);

  const save = useApiMutation<{ id: number }, ProfileWithAutopilotInput>(
    (vars) => apiClient.put("/api/profile", vars),
    {
      successMessage: "Settings saved",
      invalidate: [queryKeys.profile.all],
      onSuccess: () => setDirty(false),
    },
  );

  const form = useForm({
    defaultValues: initialData,
    validators: { onSubmit: profileWithAutopilotSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  const formApi = form as unknown as AnyReactForm;

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
            <PersonalSection form={formApi} />
          </Box>
          <Box data-section-id="address">
            <AddressSection form={formApi} />
          </Box>
          <Box data-section-id="work-auth">
            <WorkAuthSection form={formApi} />
          </Box>
          <Box data-section-id="eeo">
            <EeoSection form={formApi} />
          </Box>
          <Box data-section-id="autopilot">
            <AutopilotSection form={formApi} />
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
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
