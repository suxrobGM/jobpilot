"use client";

import { LinearProgress } from "@mui/material";
import type { ReactElement } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { RunDto } from "@/types/api";
import { RunsTable } from "./runs-table";

export function RunsContent(): ReactElement {
  const runs = useApiQuery<RunDto[]>(queryKeys.runs.list(), () =>
    apiClient.get<RunDto[]>("/api/runs"),
  );

  if (runs.isLoading) return <LinearProgress />;
  return <RunsTable rows={runs.data ?? []} loading={runs.isFetching} />;
}
