import type { ReactElement } from "react";
import { Add, ManageAccounts, TravelExplore } from "@mui/icons-material";
import { Container, Stack } from "@mui/material";
import { ProposalsList } from "@/components/features/upwork";
import { LinkButton } from "@/components/ui/buttons";
import { PageHeader } from "@/components/ui/layout";

export default function UpworkPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Upwork"
        title="Proposals"
        description="Drafted and submitted Upwork proposals, newest first."
        actions={
          <Stack direction="row" spacing={1}>
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
    </Container>
  );
}
