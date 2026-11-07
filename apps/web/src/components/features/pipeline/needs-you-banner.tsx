"use client";

import type { ReactNode } from "react";
import { Alert } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { plural } from "@/utils/format";

interface NeedsYouBannerProps {
  count: number;
}

/** Parked applications are the one stage blocked on the user, so they sit above the tabs. */
export function NeedsYouBanner(props: NeedsYouBannerProps): ReactNode {
  const { count } = props;
  if (count === 0) {
    return null;
  }
  return (
    <Alert
      severity="warning"
      variant="outlined"
      sx={{ alignItems: "center" }}
      action={
        <LinkButton href="/pilot" color="warning" size="small" variant="contained">
          Answer in Pilot
        </LinkButton>
      }
    >
      {`${plural(count, "application")} waiting on an answer from you.`}
    </Alert>
  );
}
