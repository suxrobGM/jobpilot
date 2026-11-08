"use client";

import type { ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { type SectionAnchor, SectionCard, SectionLayout } from "@/components/ui/layout";
import { AnswersSection } from "./answers-section";
import { RulesForm } from "./rules-form";
import { SearchesSection } from "./searches-section";

const ANCHORS: SectionAnchor[] = [
  { id: "searches", label: "Searches" },
  { id: "rules", label: "Rules" },
  { id: "answers", label: "Standing answers" },
];

/** What the pilot looks for and the limits it keeps; every save is a change with Undo. */
export function SearchesAndRules(): ReactElement {
  const stateQuery = useQuery(pilotQueries.state());
  const state = stateQuery.data;
  if (stateQuery.isLoading) {
    return <DetailSkeleton heights={[240, 200, 200]} />;
  }
  if (!state) {
    return (
      <QueryError title="Couldn't load the pilot." onRetry={() => void stateQuery.refetch()} />
    );
  }

  const { dailyApplyCap, minScore, dealBreakers, preferCapExempt } = state.config;
  // Keyed on the values, so a change from chat or Undo refreshes the form.
  const rulesKey = [dailyApplyCap, minScore, preferCapExempt, ...dealBreakers].join("|");

  return (
    <SectionLayout anchors={ANCHORS}>
      <Stack spacing={3}>
        <Box data-section-id="searches">
          <SectionCard
            title="Searches"
            description="What the pilot looks for. Tell it in chat to add, change or drop one."
          >
            <SearchesSection />
          </SectionCard>
        </Box>
        <Box data-section-id="rules">
          <SectionCard title="Rules">
            <RulesForm key={rulesKey} state={state} />
          </SectionCard>
        </Box>
        <Box data-section-id="answers">
          <SectionCard>
            <AnswersSection />
          </SectionCard>
        </Box>
      </Stack>
    </SectionLayout>
  );
}
