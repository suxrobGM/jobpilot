"use client";

import { type ReactElement, useState } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import { Button, Card, CardContent, Link, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";

interface QuestionCardProps {
  question: PilotQuestion;
}

export function QuestionCard(props: QuestionCardProps): ReactElement {
  const { question } = props;
  const [freeText, setFreeText] = useState("");

  const answer = useApiMutation(
    (value: string) => api.pilot.questions({ id: question.id }).answer.post({ answer: value }),
    { invalidate: [pilotQueries.questionsAll], successMessage: "Answer sent." },
  );

  const hasOptions = question.options.length > 0;
  const isLoading = answer.isPending;

  return (
    <Card>
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

          {question.link && (
            <Link
              href={question.link}
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
        </Stack>
      </CardContent>
    </Card>
  );
}
