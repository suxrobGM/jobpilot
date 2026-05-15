import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { SettingsContent } from "@/components/features/settings";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function SettingsPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, work auth, autopilot, email, and saved credentials."
      />
      <SettingsContent />
    </Stack>
  );
}
