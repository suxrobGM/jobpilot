"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { applicationQueries } from "@/api/queries";
import { statusLabel } from "@/components/ui/display";
import { FilterToggle } from "@/components/ui/form";
import { usePaginationParams } from "@/hooks/use-pagination";
import { FUNNEL, useFunnelStatus, usePipelineFilters } from "../pipeline-filters";

export function StatusFilter(): ReactElement {
  const status = useFunnelStatus();
  const pagination = usePaginationParams();
  const summary = useQuery(applicationQueries.summary(usePipelineFilters())).data;
  const options = FUNNEL.map((key) => ({
    value: key,
    label: statusLabel("application", key),
    count: summary?.byStatus[key] ?? 0,
  }));
  return (
    <FilterToggle
      label="Status"
      value={status}
      options={options}
      allCount={summary?.total}
      onChange={(next) => pagination.setFilters({ status: next })}
    />
  );
}
