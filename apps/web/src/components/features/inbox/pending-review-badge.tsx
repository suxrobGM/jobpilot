"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { Badge } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";

/** Wraps a nav icon with the count of mail waiting on a decision. */
export function PendingReviewBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const queryClient = useQueryClient();
  const query = useApiQuery(emailQueries.messageCount("pending"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.email.messageCount() });
  };

  // Mounts outside /inbox, so InboxContent's own subscription would not keep it fresh.
  useSseChannel(inboxChannel, null, { onMessage: refresh });

  return <Badge badgeContent={query.data?.count ?? 0}>{children}</Badge>;
}
