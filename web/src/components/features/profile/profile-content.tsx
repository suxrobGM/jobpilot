"use client";

import { LinearProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, type ReactElement } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProfileWithAutopilotInput } from "@/lib/schemas/profile";
import type { ProfileResponse } from "@/types/api";
import { PROFILE_DEFAULT_VALUES, ProfileForm } from "./profile-form";

export function ProfileContent(): ReactElement {
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

  return <ProfileForm defaultValues={defaultValues} />;
}
