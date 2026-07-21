"use client";

import { type ReactElement, useState } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { OpenInNew } from "@mui/icons-material";
import { Button, Card, CardContent, Link, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";

interface QuestionCardProps {
  question: PilotQuestion;
}

export function QuestionCard(props: QuestionCardProps): ReactElement {
  const { question } = props;
  const [freeText, setFreeText] = useState("");

  const answer = useApiMutation<unknown, string>(
    (value) => api.pilot.questions({ id: question.id }).answer.post({ answer: value }),
    { invalidate: [queryKeys.pilot.questionsAll()], successMessage: "Answer sent." },
  );

  const hasOptions = question.options.length > 0;
  const busy = answer.isPending;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
            <Typography variant="subtitle2">{question.prompt}</Typography>
            <Typography variant="captionMuted" sx={{ textTransform: "capitalize" }}>
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

          {hasOptions ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ flexWrap: { sm: "wrap" }, gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              {question.options.map((option) => (
                <Button
                  key={option}
                  variant="outlined"
                  size="small"
                  disabled={busy}
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
              sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}
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
                disabled={busy || freeText.trim().length === 0}
                onClick={() => answer.mutate(freeText.trim())}
                sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}
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
