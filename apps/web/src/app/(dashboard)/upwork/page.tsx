import type { ReactElement } from "react";
import { Add, ManageAccounts, TravelExplore } from "@mui/icons-material";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { ProposalsList } from "@/components/features/upwork";
import { LinkButton } from "@/components/ui/buttons";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork" };

export default function UpworkPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Upwork"
        title="Proposals"
        description="Drafted and submitted Upwork proposals, newest first."
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
              href="/campaigns/new?board=upwork.com"
            >
              Find jobs
            </LinkButton>
            <LinkButton variant="contained" startIcon={<Add fontSize="md" />} href="/upwork/new">
              New proposal
            </LinkButton>
          </Stack>
        }
      />
      <ProposalsList />
    </PageShell>
  );
}
