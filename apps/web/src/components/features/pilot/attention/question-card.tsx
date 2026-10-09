"use client";

import { type ReactElement, useState } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";

interface QuestionCardProps {
  question: PilotQuestion;
}

function answerPlaceholder(hasOptions: boolean, writeForMe: boolean): string {
  if (writeForMe) {
    return "Tell the pilot what to say, e.g. I'd relocate to Austin but prefer remote";
  }
  return hasOptions ? "Or type your own answer" : "Type your answer";
}

export function QuestionCard(props: QuestionCardProps): ReactElement {
  const { question } = props;
  const [freeText, setFreeText] = useState("");
  const [writeForMe, setWriteForMe] = useState(false);

  const answer = useApiMutation<unknown, { answer: string; writeForMe: boolean }>(
    (body) => api.pilot.questions({ id: question.id }).answer.post(body),
    { invalidate: [queryKeys.pilot.questionsAll()], successMessage: "Answer sent." },
  );

  const hasOptions = question.options.length > 0;
  const isLoading = answer.isPending;
  // A code has to be typed exactly as it arrived; there is nothing for the pilot to write.
  const canWriteForMe = question.kind !== "two_factor";
  const typed = freeText.trim();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Typography variant="body1Strong" sx={{ flex: 1, minWidth: 0 }}>
              {question.prompt}
            </Typography>
            <Typography
              variant="captionMuted"
              sx={{ flexShrink: 0, textTransform: "capitalize", whiteSpace: "nowrap" }}
            >
              {question.kind}
            </Typography>
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

          {hasOptions && (
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
                  onClick={() => answer.mutate({ answer: option, writeForMe: false })}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          )}

          <Stack spacing={0.5}>
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
                placeholder={answerPlaceholder(hasOptions, writeForMe)}
                slotProps={{
                  htmlInput: { "aria-label": answerPlaceholder(hasOptions, writeForMe) },
                }}
              />
              <Button
                variant="contained"
                size="small"
                disabled={isLoading || typed.length === 0}
                onClick={() => answer.mutate({ answer: typed, writeForMe })}
                sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0, minWidth: 88 }}
              >
                {writeForMe ? "Write it" : "Send"}
              </Button>
            </Stack>
            {canWriteForMe && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={writeForMe}
                    onChange={(e) => setWriteForMe(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="captionMuted">
                    Write it for me: the pilot drafts the answer from your instructions
                  </Typography>
                }
              />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
