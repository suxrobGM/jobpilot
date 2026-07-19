import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { ContactsTable } from "@/components/features/networking";
import { PageHeader } from "@/components/ui/layout";

export default function NetworkingPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Networking"
        title="Contacts"
        description="Hiring managers and recruiters discovered across your networking campaigns. Start a campaign in Networking mode to find more."
      />
      <ContactsTable />
    </Container>
  );
}
