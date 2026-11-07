import type { ReactElement } from "react";
import type { ApplicationStatus } from "@jobpilot/contracts/application";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { StatusChip } from "@/components/ui/display";
import { AppWindow } from "./app-window";
import { MockList, MockTabs } from "./mock-list";

const TABS = [
  { label: "Review", count: 12 },
  { label: "Applied", count: 47 },
  { label: "Interviewing", count: 2 },
];

interface MockApplication {
  company: string;
  role: string;
  score: number;
  status: ApplicationStatus;
}

const APPLICATIONS: MockApplication[] = [
  { company: "Vercel", role: "Design Engineer", score: 91, status: "interviewing" },
  { company: "Supabase", role: "Senior TypeScript Engineer", score: 88, status: "offer" },
  { company: "Stripe", role: "Senior Frontend Engineer", score: 84, status: "screening" },
  { company: "Linear", role: "Product Engineer", score: 79, status: "applied" },
];

interface ScoreProps {
  score: number;
}

/** The app's score square, at or above the bar. */
function Score(props: ScoreProps): ReactElement {
  const { score } = props;
  return (
    <Box
      sx={(theme) => ({
        width: 32,
        height: 32,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: theme.radii.md,
        typography: "body2Strong",
        color: "success.main",
        backgroundColor: alpha(theme.palette.success.main, 0.12),
      })}
    >
      {score}
    </Box>
  );
}

export function PipelinePanel(): ReactElement {
  return (
    <AppWindow page="pipeline" title="Pipeline">
      <MockTabs tabs={TABS} active="Applied" />
      <MockList
        rows={APPLICATIONS.map((app) => ({
          id: app.company,
          lead: <Score score={app.score} />,
          title: app.role,
          meta: `${app.company} · Remote`,
          end: <StatusChip domain="application" value={app.status} />,
        }))}
      />
    </AppWindow>
  );
}
