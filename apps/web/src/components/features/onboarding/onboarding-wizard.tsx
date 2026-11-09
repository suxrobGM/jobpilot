"use client";

import { type ReactElement, useState } from "react";
import {
  USER_DEFAULT_VALUES,
  type UserUpdateInput,
  userUpdateSchema,
} from "@jobpilot/contracts/user";
import {
  Alert,
  AlertTitle,
  Button,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { userQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { PersonalSection, toProfileFormValues } from "@/components/features/settings";
import { QueryError } from "@/components/ui/feedback";
import { useAppForm, withForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { patchAgentStorage } from "@/lib/terminal/agent-storage";
import { useToast } from "@/providers/toast-provider";
import { AgentSetupStep } from "./agent-setup-step";
import { ResumeUploadStep } from "./resume-upload-step";

// Minimal first run; the rest lives in Settings, surfaced by the workspace's profile checklist.
const STEPS = [
  { key: "agent", label: "Connect agent" },
  { key: "resume", label: "Resume" },
  { key: "personal", label: "Personal" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function OnboardingWizard(): ReactElement {
  const query = useQuery(userQueries.detail());

  if (query.isLoading) {
    return <LinearProgress />;
  }
  if (!query.data) {
    return <QueryError title="Couldn't load your profile." onRetry={() => void query.refetch()} />;
  }
  return <OnboardingSteps initialValues={toProfileFormValues(query.data)} />;
}

interface OnboardingStepsProps {
  initialValues: UserUpdateInput;
}

function OnboardingSteps(props: OnboardingStepsProps): ReactElement {
  const { initialValues } = props;
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState<StepKey>("agent");
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const save = useApiMutation((vars: UserUpdateInput) => api.user.put(vars), {
    successMessage: "Profile saved",
    onSuccess: () => {
      queryClient.invalidateQueries();
      // A saved profile clears the redirect gate; land on the pilot with the drawer open.
      patchAgentStorage({ drawerOpen: true });
      router.push("/pilot");
    },
  });

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onSubmit: userUpdateSchema },
    onSubmitInvalid: () => {
      setShowValidationErrors(true);
      toast.error("Some fields need fixing before we can save your profile.");
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });

  return (
    <Stack spacing={3}>
      <Stepper activeStep={STEPS.findIndex((s) => s.key === step)} alternativeLabel>
        {STEPS.map((s) => (
          <Step key={s.key}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <SectionCard>
        {step === "agent" && <AgentSetupStep onContinue={() => setStep("resume")} />}
        {step === "resume" && (
          <ResumeUploadStep
            form={form}
            onContinue={() => setStep("personal")}
            onBack={() => setStep("agent")}
          />
        )}
        {step === "personal" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <Stack spacing={3}>
              <PersonalSection form={form} />
              {showValidationErrors && <ValidationSummary form={form} />}
              <Stack direction="row" sx={{ justifyContent: "space-between", pt: 1 }}>
                <Button variant="outlined" onClick={() => setStep("resume")}>
                  Back
                </Button>
                <Button type="submit" variant="contained" loading={save.isPending}>
                  Save & finish
                </Button>
              </Stack>
            </Stack>
          </form>
        )}
      </SectionCard>
    </Stack>
  );
}

const ValidationSummary = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  render: function ValidationSummary({ form }) {
    return (
      <form.Subscribe selector={(s) => s.values}>
        {(values) => {
          const result = userUpdateSchema.safeParse(values);
          if (result.success) {
            return null;
          }

          return (
            <Alert severity="error">
              <AlertTitle>Some fields need fixing</AlertTitle>
              <Stack spacing={0.5}>
                {result.error.issues.map((issue) => {
                  const path = issue.path.map(String).join(".") || "form";
                  return (
                    <Typography key={`${path}:${issue.message}`} variant="body2">
                      <strong>{path}</strong>: {issue.message}
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
