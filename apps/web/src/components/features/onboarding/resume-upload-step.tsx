"use client";

import { useEffect, useState } from "react";
import { PROFILE_DEFAULT_VALUES } from "@jobpilot/contracts/profile";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { CheckCircle, ErrorOutlined, HourglassEmpty } from "@mui/icons-material";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { resumeQueries } from "@/api/queries";
import { invalidations } from "@/api/query-keys";
import { FileUpload } from "@/components/ui/form";
import { withForm } from "@/components/ui/form/tanstack";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";
import { applyBasicsToForm } from "./map-basics-to-profile";

type StepState = "idle" | "uploading" | "extracting" | "done";

export const ResumeUploadStep = withForm({
  defaultValues: PROFILE_DEFAULT_VALUES,
  props: { onContinue: () => {} },
  render: function ResumeUploadStep({ form, onContinue }) {
    const toast = useToast();
    const agent = useAgent();
    const agentAvailable = useAgentAvailable();
    const [state, setState] = useState<StepState>("idle");
    const [resumeId, setResumeId] = useState<string | null>(null);

    const startExtraction = async (id: string): Promise<void> => {
      setState("extracting");
      await agent.injectSkill("extract-resume", String(id));
    };

    const upload = useApiMutation<{ id: string }, File>(
      (file) => api.resumes.upload.post({ file }),
      {
        successMessage: "Resume uploaded",
        invalidate: invalidations.resume,
        onSuccess: ({ id }) => {
          setResumeId(id);
          form.setFieldValue("primaryResumeId", id);
          // Auto-fill needs the local agent; on mobile just keep the upload and move on.
          if (agentAvailable) {
            void startExtraction(id);
          } else {
            toast.info(
              "Uploaded. Open JobPilot on your desktop to auto-fill your profile from it.",
            );
            onContinue();
          }
        },
      },
    );

    // Extraction target: initial fetch covers an already-parsed resume; SSE gives
    // instant updates, and polling covers the race where the agent PUT finishes
    // before the EventSource subscription is established.
    const resume = useApiQuery(resumeQueries.detail(resumeId ?? ""), {
      enabled: resumeId !== null && state === "extracting",
      refetchInterval: 2_000,
    });

    useSseChannel(
      resumeChannel,
      { resumeId: resumeId ?? "" },
      {
        enabled: resumeId !== null && state === "extracting",
        on: {
          "content.updated": () => void resume.refetch(),
        },
      },
    );

    // Complete on content presence (not just a delivered event); the "done" state then blocks re-entry.
    useEffect(() => {
      if (state !== "extracting") {
        return;
      }
      const content = resume.data?.content;
      if (!content) {
        return;
      }
      const basics = content.basics;
      if (basics && basics.name.trim().length > 0) {
        applyBasicsToForm(form, basics);
      }
      setState("done");
      onContinue();
    }, [resume.data, state, form, onContinue]);

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
          onFile={(f) => {
            setState("uploading");
            upload.mutate(f);
          }}
          onError={(msg) => toast.error(msg)}
          disabled={isExtracting}
        />

        {isExtracting && (
          <Alert icon={<CircularProgress size={18} />} severity="info" variant="outlined">
            Reading your resume in the terminal fields will autofill when it finishes.
          </Alert>
        )}

        {isExtracting && (
          <Alert
            severity="warning"
            icon={<HourglassEmpty fontSize="md" />}
            action={
              <Button color="inherit" size="small" onClick={() => retryInject()}>
                Retry
              </Button>
            }
          >
            Still extracting. Check the terminal in the dock for progress, then continue or skip.
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
            Skip &mdash; fill manually
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
