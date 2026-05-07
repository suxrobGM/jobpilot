import type { ReactElement } from "react";
import { Container, Stack } from "@mui/material";
import { ProfileContent } from "@/components/features/profile/profile-content";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function ProfilePage(): ReactElement {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="Settings"
          title="Profile"
          description="Edit personal info, address, work authorization, EEO answers, autopilot defaults, login credentials, and resumes."
        />
        <ProfileContent />
      </Stack>
    </Container>
  );
}
