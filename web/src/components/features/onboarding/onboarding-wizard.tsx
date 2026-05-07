"use client";

import { Button, Container, Stack, Step, StepLabel, Stepper } from "@mui/material";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { AddressTab } from "@/components/features/profile/address-tab";
import { AutopilotTab } from "@/components/features/profile/autopilot-tab";
import { EeoTab } from "@/components/features/profile/eeo-tab";
import { PersonalTab } from "@/components/features/profile/personal-tab";
import {
  PROFILE_DEFAULT_VALUES,
} from "@/components/features/profile/profile-form";
import { WorkAuthTab } from "@/components/features/profile/work-auth-tab";
import { PageHeader } from "@/components/ui/layout/page-header";
import { SectionCard } from "@/components/ui/layout/section-card";
import type { AnyReactForm } from "@/components/ui/form/types";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  type ProfileWithAutopilotInput,
  profileWithAutopilotSchema,
} from "@/lib/schemas/profile";

const STEPS = [
  { key: "personal", label: "Personal" },
  { key: "address", label: "Address" },
  { key: "work-auth", label: "Work auth" },
  { key: "eeo", label: "EEO" },
  { key: "autopilot", label: "Autopilot" },
] as const;

export function OnboardingWizard(): ReactElement {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const save = useApiMutation<{ id: number }, ProfileWithAutopilotInput>(
    (vars) => apiClient.put("/api/profile", vars),
    {
      successMessage: "Profile created",
      invalidate: [queryKeys.profile.all],
      onSuccess: () => router.push("/profile"),
    },
  );

  const form = useForm({
    defaultValues: PROFILE_DEFAULT_VALUES,
    validators: { onSubmit: profileWithAutopilotSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  const formApi = form as unknown as AnyReactForm;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="First run"
          title="Welcome to JobPilot"
          description="Fill in your profile so skills can autofill applications. You can edit anything later from the profile page."
        />
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((s) => (
            <Step key={s.key}>
              <StepLabel>{s.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <SectionCard>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isLastStep) form.handleSubmit();
              else setStep((s) => s + 1);
            }}
          >
            <Stack spacing={3}>
              {step === 0 && <PersonalTab form={formApi} />}
              {step === 1 && <AddressTab form={formApi} />}
              {step === 2 && <WorkAuthTab form={formApi} />}
              {step === 3 && <EeoTab form={formApi} />}
              {step === 4 && <AutopilotTab form={formApi} />}
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", pt: 1 }}
              >
                <Button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  Back
                </Button>
                <Button type="submit" variant="contained" disabled={save.isPending}>
                  {isLastStep ? (save.isPending ? "Saving…" : "Finish") : "Next"}
                </Button>
              </Stack>
            </Stack>
          </form>
        </SectionCard>
      </Stack>
    </Container>
  );
}
