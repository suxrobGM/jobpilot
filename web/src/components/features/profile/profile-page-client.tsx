"use client";

import { Container, LinearProgress, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, type ReactElement } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import type { ProfileWithAutopilotInput } from "@/lib/schemas/profile";
import { PROFILE_DEFAULT_VALUES, ProfileForm } from "./profile-form";

interface ProfileResponseData {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    website: string | null;
    linkedin: string | null;
    github: string | null;
    street: string | null;
    aptUnit: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    usAuthorized: boolean;
    requiresSponsorship: boolean;
    visaStatus: string | null;
    optExtension: string | null;
    willingToRelocate: boolean;
    preferredLocations: string[];
    eeoGender: string | null;
    eeoRace: string | null;
    eeoEthnicity: string | null;
    eeoHispanicOrLatino: string | null;
    eeoVeteranStatus: string | null;
    eeoDisabilityStatus: string | null;
    defaultResumeId: number | null;
  } | null;
  autopilot: {
    minMatchScore: number;
    maxApplicationsPerRun: number;
    confirmMode: "batch" | "auto";
    skipCompanies: string[];
    skipTitleKeywords: string[];
    minSalary: number;
    maxSalary: number;
    salaryExpectation: string | null;
    defaultStartDate: string;
  } | null;
}

export function ProfilePageClient(): ReactElement {
  const router = useRouter();
  const query = useApiQuery<ProfileResponseData>(
    ["profile"],
    () => apiClient.get<ProfileResponseData>("/api/profile"),
    { errorMessage: "Failed to load profile" },
  );

  useEffect(() => {
    if (query.data && query.data.profile === null) {
      router.replace("/onboarding");
    }
  }, [query.data, router]);

  if (query.isLoading || !query.data) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  if (query.data.profile === null) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  const p = query.data.profile;
  const a = query.data.autopilot ?? PROFILE_DEFAULT_VALUES.autopilot;
  const defaultValues: ProfileWithAutopilotInput = {
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
    defaultResumeId: p.defaultResumeId,
    autopilot: a,
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Settings"
          title="Profile"
          description="Edit personal info, address, work authorization, EEO answers, autopilot defaults, login credentials, and resumes."
        />
        <ProfileForm defaultValues={defaultValues} />
      </Stack>
    </Container>
  );
}
