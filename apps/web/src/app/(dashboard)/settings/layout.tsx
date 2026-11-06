import type { ReactElement, ReactNode } from "react";
import { Box } from "@mui/material";
import { SettingsNav } from "@/components/features/settings";
import { PageHeader, PageShell } from "@/components/ui/layout";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout(props: SettingsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        title="Settings"
        description="Your profile, how the pilot works, and your account."
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 2, md: 4 },
          alignItems: "flex-start",
        }}
      >
        <SettingsNav />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {children}
        </Box>
      </Box>
    </PageShell>
  );
}
