import type { ReactElement } from "react";
import type { ApplicationStatus } from "@jobpilot/contracts/application";
import { ScoreBadge } from "@/components/features/pipeline/jobs/score-badge";
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

export function PipelinePanel(): ReactElement {
  return (
    <AppWindow page="pipeline" title="Pipeline">
      <MockTabs tabs={TABS} active="Applied" />
      <MockList
        rows={APPLICATIONS.map((app) => ({
          id: app.company,
          lead: <ScoreBadge score={app.score} bar={70} />,
          title: app.role,
          meta: `${app.company} Â· Remote`,
          status: <StatusChip domain="application" value={app.status} />,
        }))}
      />
    </AppWindow>
  );
}
