import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { SideSection } from "./side-section";

interface RulesSummaryProps {
  state: PilotState;
}

export function RulesSummary(props: RulesSummaryProps): ReactElement {
  const { state } = props;
  const { dailyApplyCap, minScore } = state.instructionsConfig;
  return (
    <SideSection
      title="Rules"
      action={
        <LinkButton href="/pilot/goals" size="small">
          Edit
        </LinkButton>
      }
    >
      <Typography variant="body2">{`${dailyApplyCap} a day · score ${minScore}+`}</Typography>
    </SideSection>
  );
}
