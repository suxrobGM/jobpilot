import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { ProfileContent } from "@/components/features/profile";
import { PageHeader } from "@/components/ui/layout";

export default function ProfilePage(): ReactElement {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Settings"
        title="Profile"
        description="Edit personal info, address, work authorization, EEO answers, autopilot defaults, login credentials, and resumes."
      />
      <ProfileContent />
    </Stack>
  );
}
