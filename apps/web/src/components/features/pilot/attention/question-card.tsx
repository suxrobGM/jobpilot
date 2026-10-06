"use client";

import { type ReactElement, useState } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import { Button, Card, CardContent, Link, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { RelativeTime } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/feedback";
import { formatDate } from "@/utils/format";

interface QuestionCardProps {
  question: PilotQuestion;
}

export function QuestionCard(props: QuestionCardProps): ReactElement {
  const { question } = props;
  const [freeText, setFreeText] = useState("");
  const [confirmSkipApplication, setConfirmSkipApplication] = useState(false);

  const answer = useApiMutation<unknown, string>(
    (value) => api.pilot.questions({ id: question.id }).answer.post({ answer: value }),
    { invalidate: [queryKeys.pilot.questionsAll()], successMessage: "Answer sent." },
  );
  const skipQuestion = useApiMutation<unknown, void>(
    () => api.pilot.questions({ id: question.id }).skip.post(),
    {
      invalidate: [queryKeys.pilot.questionsAll()],
      successMessage: "Question skipped - the pilot will retry without an answer.",
    },
  );
  const skipApplication = useApiMutation<unknown, void>(
    () => api.pilot.questions({ id: question.id })["skip-application"].post(),
    { invalidate: [queryKeys.pilot.questionsAll()], successMessage: "Application skipped." },
  );

  const hasOptions = question.options.length > 0;
  const isJobQuestion = question.subjectType === "job";
  const isLoading = answer.isPending || skipQuestion.isPending || skipApplication.isPending;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.5, sm: 1 }}
            sx={{ alignItems: "flex-start" }}
          >
            <Typography variant="body1Strong" sx={{ flex: 1, minWidth: 0 }}>
              {question.prompt}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              <Typography variant="captionMuted" sx={{ textTransform: "capitalize" }}>
                {question.kind}
              </Typography>
              <Typography variant="captionMuted">·</Typography>
              <Typography variant="captionMuted">{formatDate(question.createdAt)}</Typography>
              <Typography variant="captionMuted">·</Typography>
              <RelativeTime value={question.createdAt} />
            </Stack>
          </Stack>

          {question.deepLink && (
            <Link
              href={question.deepLink}
              target="_blank"
              rel="noopener"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <OpenInNew fontSize="sm" />
              Open link
            </Link>
          )}

          {hasOptions ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              // Sibling-margin spacing leaves wrapped rows flush against each other.
              useFlexGap
              sx={{ flexWrap: { sm: "wrap" }, alignItems: { xs: "stretch", sm: "center" } }}
            >
              {question.options.map((option) => (
                <Button
                  key={option}
                  variant="outlined"
                  size="small"
                  disabled={isLoading}
                  onClick={() => answer.mutate(option)}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              // Bottom edges line up: the textarea grows, the button keeps its own height.
              sx={{ alignItems: { xs: "stretch", sm: "flex-end" } }}
            >
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Type your answer"
              />
              <Button
                variant="contained"
                size="small"
                disabled={isLoading || freeText.trim().length === 0}
                onClick={() => answer.mutate(freeText.trim())}
                sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0, minWidth: 88 }}
              >
                Send
              </Button>
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button
              variant="text"
              size="small"
              color="inherit"
              disabled={isLoading}
              onClick={() => skipQuestion.mutate()}
            >
              Skip question
            </Button>
            {isJobQuestion && (
              <Button
                variant="text"
                size="small"
                color="warning"
                disabled={isLoading}
                onClick={() => setConfirmSkipApplication(true)}
              >
                Skip application
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
      <ConfirmDialog
        open={confirmSkipApplication}
        title="Skip this application?"
        description="The job is recorded as skipped by you and the pilot won't apply to it. Any other open questions about it are closed too."
        confirmLabel="Skip application"
        destructive
        onConfirm={() => {
          setConfirmSkipApplication(false);
          skipApplication.mutate();
        }}
        onCancel={() => setConfirmSkipApplication(false)}
      />
    </Card>
  );
}
