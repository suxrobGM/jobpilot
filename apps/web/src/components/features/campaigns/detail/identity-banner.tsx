"use client";

import type { ReactNode } from "react";
import { PersonOutlined, WarningAmberOutlined } from "@mui/icons-material";
import { Chip, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { userQueries } from "@/api/queries";

/**
 * Compact inline identity line for the campaign header - the active profile's name +
 * email, so a wrong-identity issue (e.g. the agent filling the wrong email) is
 * obvious at a glance.
 */
export function CampaignIdentityBanner(): ReactNode {
  const query = useApiQuery(userQueries.detail());
  const profile = query.data?.user;

  // Staying silent on failure reads as "identity confirmed", which is the one thing
  // this banner exists to rule out.
  if (query.isError) {
    return (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        <WarningAmberOutlined fontSize="sm" color="warning" />
        <Typography variant="body2">Couldn't confirm which profile is applying.</Typography>
      </Stack>
    );
  }

  if (!profile) {
    return null;
  }

  const name = `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
    >
      <PersonOutlined fontSize="sm" color="action" />
      <Typography variant="body2Strong">Applying as {name || "your profile"}</Typography>
      <Chip size="small" label={profile.contactEmail} variant="outlined" />
    </Stack>
  );
}
