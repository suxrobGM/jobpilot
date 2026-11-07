import type { ReactElement, ReactNode } from "react";
import { FindContactsButton } from "@/components/features/networking";
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
        title="Outreach"
        actions={<FindContactsButton />}
        tabs={<TabStrip tabs={TABS} ariaLabel="Networking views" />}
      />
      {children}
    </PageShell>
  );
}
