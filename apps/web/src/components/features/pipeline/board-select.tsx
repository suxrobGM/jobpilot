"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { jobBoardQueries } from "@/api/queries";
import { SelectField } from "@/components/ui/form";
import { usePaginationParams } from "@/hooks/use-pagination";

/** Filters by board domain, the form the API's board filter and board links use. */
export function BoardSelect(): ReactElement {
  const pagination = usePaginationParams();
  const value = useSearchParams().get("board");
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  return (
    <SelectField
      label="Board"
      value={value}
      options={boards.map((board) => ({ value: board.domain, label: board.name }))}
      onChange={(next) => pagination.setFilters({ board: next })}
    />
  );
}
