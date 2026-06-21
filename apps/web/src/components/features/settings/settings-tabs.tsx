import type { ReactElement } from "react";
import { Box, Stack } from "@mui/material";
import type { Route } from "next";
import { SettingsTabLink } from "./settings-tab-link";

interface SettingsTab {
  label: string;
  href: Route;
}

const TABS: SettingsTab[] = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Email", href: "/settings/email" },
  { label: "Credentials", href: "/settings/credentials" },
];

/** Server-rendered settings tab strip; only the active-link highlight is client-side. */
export function SettingsTabs(): ReactElement {
  return (
    <Box
      component="nav"
      aria-label="Settings sections"
      sx={{ mb: 3, borderBottom: 1, borderColor: "line.divider", overflowX: "auto" }}
    >
      <Stack direction="row" spacing={1}>
        {TABS.map((tab) => (
          <SettingsTabLink key={tab.href} href={tab.href} label={tab.label} />
        ))}
      </Stack>
    </Box>
  );
}
