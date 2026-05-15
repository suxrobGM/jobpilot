"use client";

import { useState, type ReactElement } from "react";
import { LinearProgress } from "@mui/material";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ApplicationDto, ApplicationListFilters } from "@/types/api";
import { buildUrl } from "@/utils/url";
import { ApplicationFilters } from "./application-filters";
import { ApplicationsTable } from "./applications-table";

export function ApplicationsContent(): ReactElement {
  const [filters, setFilters] = useState<ApplicationListFilters>({});

  const apps = useApiQuery<ApplicationDto[]>(
    queryKeys.applications.list(filters as Record<string, unknown>),
    () =>
      apiClient.get<ApplicationDto[]>(
        buildUrl("/api/applied", {
          stage: filters.stage,
          board: filters.board,
          source: filters.source,
          search: filters.search,
        }),
      ),
  );

  const boardSet = new Set<string>();
  for (const app of apps.data ?? []) {
    if (app.board) boardSet.add(app.board);
  }
  const boards = Array.from(boardSet).sort();

  return (
    <>
      <ApplicationFilters filters={filters} boards={boards} onChange={setFilters} />
      {apps.isLoading ? (
        <LinearProgress />
      ) : (
        <ApplicationsTable rows={apps.data ?? []} loading={apps.isFetching} />
      )}
    </>
  );
}
