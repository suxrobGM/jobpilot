"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Stack } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import { PilotStateLoader } from "../state/pilot-state-loader";
import { AnswersSection } from "./answers-section";
import { RulesForm } from "./rules-form";
import { SearchesSection } from "./searches-section";
import type { SectionAnchor } from "./section-anchor-nav";
import { SectionLayout } from "./section-layout";

const ANCHORS: SectionAnchor[] = [
  { id: "searches", label: "Searches" },
  { id: "rules", label: "Rules" },
  { id: "answers", label: "Standing answers" },
];

/** What the pilot looks for and the limits it keeps; every save is a change with Undo. */
export function SearchesAndRules(): ReactElement {
  return (
    <PilotStateLoader heights={[240, 200, 200]}>
      {(state) => <SearchesAndRulesBody state={state} />}
    </PilotStateLoader>
  );
}

interface SearchesAndRulesBodyProps {
  state: PilotState;
}

function SearchesAndRulesBody(props: SearchesAndRulesBodyProps): ReactElement {
  const { state } = props;
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
