"use client";

import { useState, type ReactElement, type SubmitEvent } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import {
  PROFILE_DEFAULT_VALUES,
  profileWithAutoApplySchema,
  type ProfileWithAutoApplyInput,
} from "@jobpilot/contracts/profile";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { DeleteProfileResponse, SetActiveProfileResponse } from "@/api/types";
import {
  AddressSection,
  AutoApplySection,
  EeoSection,
  PersonalSection,
  WorkAuthSection,
} from "@/components/features/settings/sections";
import { useAppForm, withForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { useToast } from "@/providers/notification-provider";
import { ResumeUploadStep } from "./resume-upload-step";
import { useEnsureDraftProfile } from "./use-ensure-draft-profile";
import { describeIssues, firstStepWithIssue } from "./validation-issues";

const STEPS = [
  { key: "resume", label: "Resume" },
  { key: "personal", label: "Personal" },
  { key: "address", label: "Address" },
  { key: "work-auth", label: "Work auth" },
  { key: "eeo", label: "EEO" },
  { key: "auto-apply", label: "Auto-apply" },
] as const;

interface OnboardingWizardProps {
  isNewProfile: boolean;
}

export function OnboardingWizard(props: OnboardingWizardProps): ReactElement {
  const { isNewProfile } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, draftProfileId, previousActiveId } = useEnsureDraftProfile();
  const [step, setStep] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const canCancel = isNewProfile && previousActiveId !== null && draftProfileId !== null;

  const save = useApiMutation<{ id: number }, ProfileWithAutoApplyInput>(
    (vars) => apiClient.put("/api/profile", vars),
    {
      successMessage: isNewProfile ? "Profile created" : "Profile saved",
      invalidate: [queryKeys.profile.all, queryKeys.profiles.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
        router.push(isNewProfile ? "/" : "/settings");
      },
    },
  );

  const discard = useApiMutation<DeleteProfileResponse, void>(
    async () => {
      if (previousActiveId === null || draftProfileId === null) {
        return { data: null, error: { code: "INVALID_STATE", message: "No draft to discard" } };
      }
      const restored = await apiClient.post<SetActiveProfileResponse>("/api/profiles/active", {
        profileId: previousActiveId,
      });
      if (restored.error) {
        return { data: null, error: restored.error };
      }
      return apiClient.del<DeleteProfileResponse>(`/api/profiles/${draftProfileId}`);
    },
    {
      successMessage: "Draft discarded",
      invalidate: [queryKeys.profile.all, queryKeys.profiles.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
        router.push("/");
      },
    },
  );

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: "Discard new profile?",
      description: "Any data you've added — including uploaded resumes — will be deleted.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (confirmed) {
      discard.mutate();
    }
  };

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

  if (!ready) {
    return (
      <Stack sx={{ py: 6, alignItems: "center" }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {canCancel && (
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button
            variant="text"
            color="inherit"
            onClick={handleCancel}
            disabled={discard.isPending}
          >
            {discard.isPending ? "Discarding…" : "Cancel"}
          </Button>
        </Stack>
      )}
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
