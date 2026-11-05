"use client";

import { useEffect, useState } from "react";
import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { CheckCircle, ErrorOutlined, HourglassEmpty } from "@mui/icons-material";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/queries";
import { useResumeExtraction } from "@/components/features/resumes/use-resume-extraction";
import { FileUpload } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/toast-provider";
import { applyBasicsToForm } from "./map-basics-to-profile";

type StepState = "idle" | "extracting" | "done";

// Long enough for a normal extraction; past it, offer a retry.
const SLOW_EXTRACTION_MS = 90_000;

export const ResumeUploadStep = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  props: { onContinue: () => {} },
  render: function ResumeUploadStep({ form, onContinue }) {
    const toast = useToast();
    const agent = useAgent();
    const agentAvailable = useAgentAvailable();
    const [state, setState] = useState<StepState>("idle");
    const [resumeId, setResumeId] = useState<string | null>(null);
    const [slow, setSlow] = useState(false);

    const startExtraction = async (id: string): Promise<void> => {
      setState("extracting");
      setSlow(false);
      await agent.injectSkill("extract-resume", id);
    };

    const upload = useApiMutation((file: File) => api.resumes.upload.post({ file }), {
      successMessage: "Resume uploaded",
      invalidate: invalidations.resume,
      onSuccess: ({ id }) => {
        setResumeId(id);
        form.setFieldValue("primaryResumeId", id);
        // Auto-fill needs the local agent; on mobile just keep the upload and move on.
        if (agentAvailable) {
          void startExtraction(id);
        } else {
          toast.info("Uploaded. Open JobPilot on your desktop to auto-fill your profile from it.");
          onContinue();
        }
      },
    });

    const { content } = useResumeExtraction(resumeId, state === "extracting");

    // Complete on content presence (not just a delivered event); the "done" state then blocks re-entry.
    useEffect(() => {
      if (state !== "extracting" || !content) {
        return;
      }
      const basics = content.basics;
      if (basics && basics.name.trim().length > 0) {
        applyBasicsToForm(form, basics);
      }
      setState("done");
      // extract-resume chains review-resume itself, so onboarding never waits on the suggestion.
      onContinue();
    }, [content, state, form, onContinue]);

    useEffect(() => {
      if (state !== "extracting" || slow) {
        return;
      }
      const timer = setTimeout(() => setSlow(true), SLOW_EXTRACTION_MS);
      return () => clearTimeout(timer);
    }, [state, slow]);

    const retryInject = async (): Promise<void> => {
      if (resumeId === null) {
        return;
      }
      await startExtraction(resumeId);
    };

    const isExtracting = state === "extracting";

    return (
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Upload your resume</Typography>
          <Typography variant="body2Muted">
            We&rsquo;ll read your PDF and fill in the rest. You can edit anything afterwards.
          </Typography>
        </Stack>

        <FileUpload
          variant="dropzone"
          accept="application/pdf"
          maxBytes={MAX_RESUME_BYTES}
          loading={upload.isPending}
          description="Click or drop a PDF here (5 MB max)"
          onFile={(f) => upload.mutate(f)}
          onError={(msg) => toast.error(msg)}
          disabled={isExtracting}
        />

        {isExtracting && !slow && (
          <Alert icon={<CircularProgress size={18} />} severity="info" variant="outlined">
            Reading your resume in the terminal. The fields fill in when it finishes.
          </Alert>
        )}

        {isExtracting && slow && (
          <Alert
            severity="warning"
            icon={<HourglassEmpty fontSize="md" />}
            action={
              <Button color="inherit" size="small" onClick={() => retryInject()}>
                Retry
              </Button>
            }
          >
            Still extracting. Check the terminal in the dock for progress, retry, or continue and
            fill the rest in by hand.
          </Alert>
        )}

        {state === "done" && (
          <Alert severity="success" icon={<CheckCircle fontSize="md" />}>
            Resume parsed. Moving on
          </Alert>
        )}

        {upload.error && (
          <Alert severity="error" icon={<ErrorOutlined fontSize="md" />}>
            {upload.error.message}
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
          <Button variant="text" onClick={onContinue} disabled={isExtracting}>
            Skip - fill manually
          </Button>
          {(isExtracting || state === "done") && (
            <Button variant="contained" onClick={onContinue}>
              Continue
            </Button>
          )}
        </Stack>
      </Stack>
    );
  },
});
