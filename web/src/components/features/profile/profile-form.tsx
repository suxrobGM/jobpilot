"use client";

import { Box, Button, Stack, Tab, Tabs } from "@mui/material";
import { useForm } from "@tanstack/react-form";
import { useState, type ReactElement } from "react";
import type { AnyReactForm } from "@/components/ui/form/types";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiClient } from "@/lib/api-client";
import {
  type ProfileWithAutopilotInput,
  profileWithAutopilotSchema,
} from "@/lib/schemas/profile";
import { AddressTab } from "./address-tab";
import { AutopilotTab } from "./autopilot-tab";
import { EeoTab } from "./eeo-tab";
import { PersonalTab } from "./personal-tab";
import { WorkAuthTab } from "./work-auth-tab";

interface ProfileFormProps {
  defaultValues: ProfileWithAutopilotInput;
}

const TAB_KEYS = ["personal", "address", "work-auth", "eeo", "autopilot"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function ProfileForm(props: ProfileFormProps): ReactElement {
  const { defaultValues } = props;
  const [tab, setTab] = useState<TabKey>("personal");

  const save = useApiMutation<{ id: number }, ProfileWithAutopilotInput>(
    (vars) => apiClient.put("/api/profile", vars),
    {
      successMessage: "Profile saved",
      invalidate: [["profile"]],
    },
  );

  const form = useForm({
    defaultValues,
    validators: { onSubmit: profileWithAutopilotSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack spacing={3}>
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="personal" label="Personal" />
          <Tab value="address" label="Address" />
          <Tab value="work-auth" label="Work auth" />
          <Tab value="eeo" label="EEO" />
          <Tab value="autopilot" label="Autopilot" />
        </Tabs>
        <Box sx={{ pt: 1 }}>
          {tab === "personal" && <PersonalTab form={form as unknown as AnyReactForm} />}
          {tab === "address" && <AddressTab form={form as unknown as AnyReactForm} />}
          {tab === "work-auth" && <WorkAuthTab form={form as unknown as AnyReactForm} />}
          {tab === "eeo" && <EeoTab form={form as unknown as AnyReactForm} />}
          {tab === "autopilot" && <AutopilotTab form={form as unknown as AnyReactForm} />}
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

export const PROFILE_DEFAULT_VALUES: ProfileWithAutopilotInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  website: "",
  linkedin: "",
  github: "",
  street: "",
  aptUnit: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  usAuthorized: true,
  requiresSponsorship: false,
  visaStatus: "",
  optExtension: "",
  willingToRelocate: false,
  preferredLocations: [],
  eeoGender: "Prefer not to disclose",
  eeoRace: "Prefer not to disclose",
  eeoEthnicity: "Prefer not to disclose",
  eeoHispanicOrLatino: "Prefer not to disclose",
  eeoVeteranStatus: "Prefer not to disclose",
  eeoDisabilityStatus: "Prefer not to disclose",
  defaultResumeId: null,
  autopilot: {
    minMatchScore: 6,
    maxApplicationsPerRun: 20,
    confirmMode: "batch",
    skipCompanies: [],
    skipTitleKeywords: [],
    minSalary: 0,
    maxSalary: 0,
    salaryExpectation: "",
    defaultStartDate: "2 weeks notice",
  },
};
