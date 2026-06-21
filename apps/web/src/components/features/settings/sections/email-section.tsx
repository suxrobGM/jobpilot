import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { ConnectCard } from "./connect-card";
import { OAuthClientCard } from "./oauth-client-card";

/**
 * Email integration cards composed for client-only contexts (onboarding), where
 * the cards self-fetch. The settings route composes them directly so it can pass
 * SSR-fetched seeds as props.
 */
export function EmailSection(): ReactElement {
  return (
    <Stack spacing={3}>
      <OAuthClientCard />
      <ConnectCard />
    </Stack>
  );
}
