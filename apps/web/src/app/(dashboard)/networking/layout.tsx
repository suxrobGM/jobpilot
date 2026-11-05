import type { ReactElement, ReactNode } from "react";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Contacts", href: "/networking/contacts" },
  { label: "Messages", href: "/networking/messages" },
];

interface NetworkingLayoutProps {
  children: ReactNode;
}

export default function NetworkingLayout(props: NetworkingLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Networking"
        title="Outreach"
        description="Hiring managers and recruiters found across your campaigns, and every message drafted to them."
      />
      <TabStrip tabs={TABS} ariaLabel="Networking views" />
      {children}
    </PageShell>
  );
}
