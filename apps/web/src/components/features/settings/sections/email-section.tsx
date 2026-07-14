import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { ConnectCard } from "./connect-card";
import { OAuthClientCard } from "./oauth-client-card";

/** Email integration cards; both self-fetch, so any context can compose this bare. */
export function EmailSection(): ReactElement {
  return (
    <Stack spacing={3}>
      <OAuthClientCard />
      <ConnectCard />
    </Stack>
  );
}
