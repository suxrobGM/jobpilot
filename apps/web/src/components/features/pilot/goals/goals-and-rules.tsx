"use client";

import type { ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { type SectionAnchor, SectionCard, SectionLayout } from "@/components/ui/layout";
import { AnswersSection } from "./answers-section";
import { GoalsForm } from "./goals-form";
import { RulesForm } from "./rules-form";
import { SearchesSection } from "./searches-section";

const ANCHORS: SectionAnchor[] = [
  { id: "goals", label: "Goals" },
  { id: "rules", label: "Rules" },
  { id: "searches", label: "Searches" },
  { id: "answers", label: "Standing answers" },
];

/** What the pilot works toward and the limits it keeps; every save is a change with Undo. */
export function GoalsAndRules(): ReactElement {
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

  const { dailyApplyCap, minScore, dealBreakers } = state.config;
  // Keyed the same way, so Undo or chat refreshes the rules form.
  const rulesKey = [dailyApplyCap, minScore, ...dealBreakers].join("|");

  return (
    <SectionLayout anchors={ANCHORS}>
      <Stack spacing={3}>
        <Box data-section-id="goals">
          <SectionCard title="Goals">
            {/* Keyed so a goals change made elsewhere (chat, Undo) resets the form. */}
            <GoalsForm key={state.goals} state={state} />
          </SectionCard>
        </Box>
        <Box data-section-id="rules">
          <SectionCard title="Rules">
            <RulesForm key={rulesKey} state={state} />
          </SectionCard>
        </Box>
        <Box data-section-id="searches">
          <SectionCard
            title="Searches"
            description="The pilot builds and runs these from your goals."
          >
            <SearchesSection />
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
