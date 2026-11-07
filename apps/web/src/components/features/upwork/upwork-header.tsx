import type { ReactElement } from "react";
import { Add, ManageAccounts, TravelExplore } from "@mui/icons-material";
import { Stack } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { PageHeader } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Proposals", href: "/upwork" },
  { label: "Inbox", href: "/upwork/inbox" },
];

/** Shared by the Proposals and Inbox tabs; the detail pages under /upwork keep their own header. */
export function UpworkHeader(): ReactElement {
  return (
    <PageHeader
      title="Upwork"
      tabs={<TabStrip tabs={TABS} ariaLabel="Upwork views" />}
      actions={
        // These lead to agent-driven flows, so hide them on mobile (read-only UI).
        <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }}>
          <LinkButton
            variant="outlined"
            startIcon={<ManageAccounts fontSize="md" />}
            href="/upwork/profile"
          >
            Enhance profile
          </LinkButton>
          <LinkButton
            variant="outlined"
            startIcon={<TravelExplore fontSize="md" />}
            href="/pipeline?board=upwork.com"
          >
            Upwork jobs
          </LinkButton>
          <LinkButton variant="contained" startIcon={<Add fontSize="md" />} href="/upwork/new">
            New proposal
          </LinkButton>
        </Stack>
      }
    />
  );
}
