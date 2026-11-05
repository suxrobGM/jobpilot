import type { ReactElement, ReactNode } from "react";
import { NotificationsNone } from "@mui/icons-material";
import { LinkButton } from "@/components/ui/buttons";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Overview", href: "/pilot" },
  { label: "Instructions", href: "/pilot/instructions" },
  { label: "Activity", href: "/pilot/activity" },
];

interface PilotLayoutProps {
  children: ReactNode;
}

export default function PilotLayout(props: PilotLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Workspace"
        title="Pilot"
        description="Run JobPilot autonomously: set your instructions, watch its journal, and answer its questions."
        actions={
          <LinkButton
            href="/settings/notifications"
            size="small"
            variant="outlined"
            startIcon={<NotificationsNone fontSize="sm" />}
          >
            Notifications
          </LinkButton>
        }
      />
      <TabStrip tabs={TABS} ariaLabel="Pilot sections" />
      {children}
    </PageShell>
  );
}
