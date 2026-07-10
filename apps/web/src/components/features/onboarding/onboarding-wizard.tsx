"use client";

import { type ReactElement, type SubmitEvent, useState } from "react";
import {
  PROFILE_DEFAULT_VALUES,
  type ProfileWithAutoApplyInput,
  profileWithAutoApplySchema,
} from "@jobpilot/contracts/profile";
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
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { PersonalSection } from "@/components/features/settings/sections";
import { useAppForm, withForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { patchAgentStorage } from "@/lib/agent-storage";
import { useToast } from "@/providers/notification-provider";
import { AgentSetupStep } from "./agent-setup-step";
import { ResumeUploadStep } from "./resume-upload-step";
import { describeIssues, firstStepWithIssue } from "./validation-issues";

// Minimal first run: resume + personal basics + agent install. Everything else
// (address, work auth, EEO, auto-apply, email, credentials) lives in Settings,
// surfaced by the workspace's profile checklist.
const STEPS = [
  { key: "resume", label: "Resume" },
  { key: "personal", label: "Personal" },
  { key: "agent", label: "Connect agent" },
] as const;

/** Profile-form steps come first; the agent step is a self-contained section. */
const PROFILE_STEPS = STEPS.findIndex((s) => s.key === "agent");

export function OnboardingWizard(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // The user's single profile is co-created at registration, so onboarding just
  // populates it via PUT /profile - no draft/active-profile dance.
  const save = useApiMutation<{ id: string }, ProfileWithAutoApplyInput>(
    (vars) => api.profile.put(vars),
    {
      successMessage: "Profile saved",
      invalidate: [queryKeys.profile.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        // Profile saved (non-empty) clears the redirect gate, so the optional steps can navigate away safely.
        setStep(PROFILE_STEPS);
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
  const isProfileStep = step < PROFILE_STEPS;
  const isLastProfileStep = step === PROFILE_STEPS - 1;

  const finish = (): void => {
    // Land on the workspace with the dock open so the agent is the obvious next step.
    patchAgentStorage({ dockExpanded: true });
    router.push("/workspace");
  };

  const submitForm = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLastProfileStep) {
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
        {isProfileStep ? (
          <form onSubmit={submitForm}>
            <Stack spacing={3}>
              {step === 0 && <ResumeUploadStep form={form} onContinue={() => setStep(1)} />}
              {step === 1 && <PersonalSection form={form} />}
              {showValidationErrors && <ValidationSummary form={form} />}
              {step !== 0 && (
                <Stack direction="row" sx={{ justifyContent: "space-between", pt: 1 }}>
                  <Button variant="outlined" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                    Back
                  </Button>
                  <Button type="submit" variant="contained" disabled={save.isPending}>
                    {isLastProfileStep ? (save.isPending ? "Saving…" : "Save & continue") : "Next"}
                  </Button>
                </Stack>
              )}
            </Stack>
          </form>
        ) : (
          <Stack spacing={3}>
            <AgentSetupStep />
            <Stack direction="row" sx={{ justifyContent: "space-between", pt: 1 }}>
              <Button variant="outlined" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
              <Button variant="contained" onClick={finish}>
                Finish
              </Button>
            </Stack>
          </Stack>
        )}
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
                {issues.map((issue) => {
                  const stepLabel = issue.stepIndex !== null ? STEPS[issue.stepIndex]?.label : null;
                  return (
                    <Typography key={`${issue.path}:${issue.message}`} variant="body2">
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
