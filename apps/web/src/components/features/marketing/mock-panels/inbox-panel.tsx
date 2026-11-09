import type { ReactElement } from "react";
import type { Classification } from "@jobpilot/contracts/email";
import { ListLead } from "@/components/ui/data";
import { StatusChip } from "@/components/ui/display";
import { initials } from "@/utils/format";
import { AppWindow } from "./app-window";
import { MockList, MockTabs } from "./mock-list";

const TABS = [
  { label: "Needs review", count: 1 },
  { label: "All", count: 38 },
];

interface Message {
  from: string;
  subject: string;
  classification: Classification;
}

const MESSAGES: Message[] = [
  {
    from: "Sarah Chen",
    subject: "Next steps for Design Engineer · Vercel",
    classification: "interviewing",
  },
  { from: "Supabase Talent", subject: "Your offer from Supabase", classification: "offer" },
  { from: "Greenhouse", subject: "Your verification code", classification: "verification" },
  { from: "Ramp Recruiting", subject: "Update on your application", classification: "rejected" },
];

export function InboxPanel(): ReactElement {
  return (
    <AppWindow page="inbox" title="Inbox">
      <MockTabs tabs={TABS} active="All" />
      <MockList
        rows={MESSAGES.map((message) => ({
          id: message.from,
          lead: <ListLead>{initials(message.from)}</ListLead>,
          title: message.from,
          meta: message.subject,
          status: <StatusChip domain="classification" value={message.classification} />,
        }))}
      />
    </AppWindow>
  );
}
