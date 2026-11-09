"use client";

import { useEffect, useState } from "react";
import { USER_DEFAULT_VALUES } from "@jobpilot/contracts/user";
import { CheckCircle, ErrorOutlined, HourglassEmpty } from "@mui/icons-material";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { StartAgentButton } from "@/components/features/agent/start-agent-button";
import { useAgentHealth } from "@/components/features/agent/use-agent-health";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { useResumeExtraction } from "@/components/features/resumes/use-resume-extraction";
import { FileUpload } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { canRelaunch } from "@/hooks/use-terminal-health";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useAgentConnected } from "@/providers/agent-provider";
import { useToast } from "@/providers/toast-provider";
import { applyBasicsToForm } from "./map-basics-to-profile";

type StepState = "idle" | "extracting" | "done";

// Long enough for a normal extraction; past it, offer a retry.
const SLOW_EXTRACTION_MS = 90_000;

export const ResumeUploadStep = withForm({
  defaultValues: USER_DEFAULT_VALUES,
  props: { onContinue: () => {}, onBack: () => {} },
  render: function ResumeUploadStep({ form, onContinue, onBack }) {
    const toast = useToast();
    const request = useCreateRequest();
    const [state, setState] = useState<StepState>("idle");
    const [resumeId, setResumeId] = useState<string | null>(null);
    const [slow, setSlow] = useState(false);
    const connected = useAgentConnected();
    const agent = useAgentHealth();
    // Null while loading, so the spinner shows instead of a warning flash.
    const agentMissing = connected === false;
    const relaunchable = canRelaunch(agent);

    const startExtraction = async (id: string): Promise<void> => {
      setState("extracting");
      setSlow(false);
      await request.mutateAsync({
        taskType: "resume.extract",
        payload: { resumeId: id, force: false },
      });
    };

    const upload = useApiMutation((file: File) => api.resumes.upload.post({ file }), {
      successMessage: "Resume uploaded",
      invalidate: invalidations.resume,
      onSuccess: ({ id }) => {
        setResumeId(id);
        form.setFieldValue("primaryResumeId", id);
        void startExtraction(id);
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

    // The clock starts once an agent can pick the request up.
    useEffect(() => {
      if (state !== "extracting" || slow || agentMissing) {
        return;
      }
      const timer = setTimeout(() => setSlow(true), SLOW_EXTRACTION_MS);
      return () => clearTimeout(timer);
    }, [state, slow, agentMissing]);

    const isExtracting = state === "extracting";
    const waitingForAgent = isExtracting && agentMissing;
    const reading = isExtracting && !agentMissing;
    const started = isExtracting || state === "done";

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

        {waitingForAgent && (
          <Alert
            severity="warning"
            icon={<HourglassEmpty fontSize="md" />}
            action={
              relaunchable && (
                <StartAgentButton
                  color="inherit"
                  variant="text"
                  onStart={() => agent.beginPending("starting")}
                />
              )
            }
          >
            {relaunchable
              ? "Resume saved, but the agent isn't running. Start it and the fields fill in here, or continue and fill them in yourself."
              : "Resume saved; the agent reads it once one connects. Go back to connect it, or continue and fill in the details yourself."}
          </Alert>
        )}

        {reading && !slow && (
          <Alert icon={<CircularProgress size={18} />} severity="info" variant="outlined">
            Reading your resume in the terminal. The fields fill in when it finishes.
          </Alert>
        )}

        {reading && slow && (
          <Alert
            severity="warning"
            icon={<HourglassEmpty fontSize="md" />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => resumeId && void startExtraction(resumeId)}
              >
                Retry
              </Button>
            }
          >
            Still extracting. Check the terminal in the agent drawer for progress, retry, or
            continue and fill the rest in by hand.
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

        <Stack direction="row" sx={{ justifyContent: "space-between", pt: 1 }}>
          <Button variant="outlined" onClick={onBack}>
            Back
          </Button>
          <Button variant={started ? "contained" : "text"} onClick={onContinue}>
            {started ? "Continue" : "Skip - fill manually"}
          </Button>
        </Stack>
      </Stack>
    );
  },
});
