import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import type { Metadata } from "next";
import { EmailSection } from "@/components/features/settings";

export const metadata: Metadata = { title: "Email" };

export default function EmailSettingsPage(): ReactElement {
  return (
    <Stack spacing={3}>
      <EmailSection />
    </Stack>
  );
}
