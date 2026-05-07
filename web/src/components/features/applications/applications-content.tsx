"use client";

import { LinearProgress } from "@mui/material";
import { useMemo, useState, type ReactElement } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ApplicationDto, ApplicationListFilters } from "@/types/api";
import { ApplicationFilters } from "./application-filters";
import { ApplicationsTable } from "./applications-table";

function buildQuery(filters: ApplicationListFilters): string {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.board) params.set("board", filters.board);
  if (filters.source) params.set("source", filters.source);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function ApplicationsContent(): ReactElement {
  const [filters, setFilters] = useState<ApplicationListFilters>({});

  const apps = useApiQuery<ApplicationDto[]>(
    queryKeys.applications.list(filters as Record<string, unknown>),
    () => apiClient.get<ApplicationDto[]>(`/api/applied${buildQuery(filters)}`),
  );

  const boards = useMemo(() => {
    const set = new Set<string>();
    for (const app of apps.data ?? []) if (app.board) set.add(app.board);
    return Array.from(set).sort();
  }, [apps.data]);

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
