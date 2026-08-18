"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { Badge } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { useSseChannel } from "@/lib/sse/client";

// The count is the pagination total, so one row is enough to carry it.
const COUNT_ONLY = { page: 1, limit: 1 };

export function PendingReviewBadge(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const queryClient = useQueryClient();
  const query = useApiQuery(emailQueries.messages("pending", COUNT_ONLY));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
  };

  // Mounts outside /inbox, so InboxContent's own subscription would not keep it fresh.
  useSseChannel(inboxChannel, null, { onMessage: refresh });

  return <Badge badgeContent={query.data?.pagination.total ?? 0}>{children}</Badge>;
}
