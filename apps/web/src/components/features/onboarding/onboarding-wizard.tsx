"use client";

import { useState, type ReactElement, type SubmitEvent } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { unwrap } from "@/api/client";
import { api } from "@/api/eden";
import {
  PROFILE_DEFAULT_VALUES,
  profileWithAutoApplySchema,
  type ProfileWithAutoApplyInput,
} from "@jobpilot/contracts/profile";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import {
  AddressSection,
  AutoApplySection,
  EeoSection,
  PersonalSection,
  WorkAuthSection,
} from "@/components/features/settings/sections";
import { useAppForm, withForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useToast } from "@/providers/notification-provider";
import { ResumeUploadStep } from "./resume-upload-step";
import { describeIssues, firstStepWithIssue } from "./validation-issues";

const STEPS = [
  { key: "resume", label: "Resume" },
  { key: "personal", label: "Personal" },
  { key: "address", label: "Address" },
  { key: "work-auth", label: "Work auth" },
  { key: "eeo", label: "EEO" },
  { key: "auto-apply", label: "Auto-apply" },
] as const;

export function OnboardingWizard(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // The user's single profile is co-created at registration, so onboarding just
  // populates it via PUT /profile — no draft/active-profile dance.
  const save = useApiMutation<{ id: number }, ProfileWithAutoApplyInput>(
    (vars) => unwrap(api.profile.put(vars)),
    {
      successMessage: "Profile saved",
      invalidate: [queryKeys.profile.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
        router.push("/settings");
      },
    },
  );

  const form = useAppForm({
    defaultValues: PROFILE_DEFAULT_VALUES,
    validators: { onSubmit: profileWithAutoApplySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });
  const isLastStep = step === STEPS.length - 1;

  const submitForm = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    const result = profileWithAutoApplySchema.safeParse(form.state.values);
    if (!result.success) {
      const issues = describeIssues(result.error.issues);
      setShowValidationErrors(true);
      const target = firstStepWithIssue(issues);
      if (target !== null) {
        setStep(target);
      }
      toast.error("Some fields need fixing before we can save your profile.");
      return;
    }

    setShowValidationErrors(false);
    await form.handleSubmit();
  };

  return (
    <Stack spacing={3}>
      <Stepper activeStep={step} alternativeLabel>
        {STEPS.map((s) => (
          <Step key={s.key}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <SectionCard>
        <form onSubmit={submitForm}>
          <Stack spacing={3}>
            {step === 0 && <ResumeUploadStep form={form} onContinue={() => setStep(1)} />}
            {step === 1 && <PersonalSection form={form} />}
            {step === 2 && <AddressSection form={form} />}
            {step === 3 && <WorkAuthSection form={form} />}
            {step === 4 && <EeoSection form={form} />}
            {step === 5 && <AutoApplySection form={form} />}
            {showValidationErrors && <ValidationSummary form={form} />}
            {step !== 0 && (
              <Stack direction="row" sx={{ justifyContent: "space-between", pt: 1 }}>
                <Button variant="outlined" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  Back
                </Button>
                <Button type="submit" variant="contained" disabled={save.isPending}>
                  {isLastStep ? (save.isPending ? "Saving…" : "Finish") : "Next"}
                </Button>
              </Stack>
            )}
          </Stack>
        </form>
      </SectionCard>
    </Stack>
  );
}

const ValidationSummary = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  render: function ValidationSummary({ form }) {
    return (
      <form.Subscribe selector={(s) => s.values}>
        {(values) => {
          const result = profileWithAutoApplySchema.safeParse(values);
          if (result.success) {
            return null;
          }

          const issues = describeIssues(result.error.issues);
          return (
            <Alert severity="error">
              <AlertTitle>Some fields need fixing</AlertTitle>
              <Stack spacing={0.5}>
                {issues.map((issue, i) => {
                  const stepLabel = issue.stepIndex !== null ? STEPS[issue.stepIndex]?.label : null;
                  return (
                    <Typography key={i} variant="body2">
                      <strong>{issue.path}</strong>
                      {stepLabel ? ` (${stepLabel} step)` : ""}: {issue.message}
                    </Typography>
                  );
                })}
              </Stack>
            </Alert>
          );
        }}
      </form.Subscribe>
    );
  },
});
