import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { ContactsTable } from "@/components/features/outreach";
import { PageHeader } from "@/components/ui/layout";

export default function OutreachPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Outreach"
        title="Contacts"
        description="Hiring managers and recruiters discovered across your outreach campaigns. Start a campaign from a new campaign in Outreach mode."
      />
      <ContactsTable />
    </Container>
  );
}
