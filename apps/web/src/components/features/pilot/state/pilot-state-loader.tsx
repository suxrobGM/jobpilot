"use client";

import type { ReactNode } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";

interface PilotStateLoaderProps {
  /** Skeleton block heights, shaped like the page underneath. */
  heights: number[];
  children: (state: PilotState) => ReactNode;
}

/** Shows a skeleton while the pilot state loads, then renders the children with it. */
export function PilotStateLoader(props: PilotStateLoaderProps): ReactNode {
  const { heights, children } = props;
  const query = useQuery(pilotQueries.state());

  if (query.isLoading) {
    return <DetailSkeleton heights={heights} />;
  }
  if (!query.data) {
    return <QueryError title="Couldn't load the pilot." onRetry={() => void query.refetch()} />;
  }
  return children(query.data);
}
