"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import { QuestionCard } from "./question-card";
import { useOpenQuestions } from "./use-open-questions";

export function QuestionList(): ReactElement {
  const { questions, isLoading } = useOpenQuestions();

  return (
    <SectionCard title="Questions">
      {isLoading ? (
        <LinearProgress />
      ) : questions.length === 0 ? (
        <Typography variant="body2Muted">Nothing needs your attention right now.</Typography>
      ) : (
        <Stack spacing={2}>
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
