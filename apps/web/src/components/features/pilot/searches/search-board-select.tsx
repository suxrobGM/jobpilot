"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { SelectField } from "@/components/ui/form";
import { useMakeChange } from "../changes/use-changes";

interface SearchBoardSelectProps {
  search: FeedDto;
}

/** Pins a search to one board, or returns it to the checked-board rotation. */
export function SearchBoardSelect(props: SearchBoardSelectProps): ReactElement {
  const { search } = props;
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const change = useMakeChange();

  const pin = (domain: string | null): void => {
    const board = boards.find((b) => b.domain === domain);
    const summary = board
      ? `Pinned ${search.name} to ${board.name}`
      : `Returned ${search.name} to the board rotation`;
    change.mutate({
      summary,
      actions: [{ type: "search.update", searchId: search.id, board: domain }],
    });
  };

  return (
    <SelectField
      label="Board"
      value={search.board?.domain ?? null}
      options={boards.map((board) => ({ value: board.domain, label: board.name }))}
      emptyLabel="Rotate checked boards"
      disabled={change.isPending}
      onChange={pin}
    />
  );
}
