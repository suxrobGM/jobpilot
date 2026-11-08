"use client";

import type { ReactElement } from "react";
import { MenuItem, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { jobBoardQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { useMakeChange } from "../changes/use-changes";

const ROTATE = "";

interface SearchBoardSelectProps {
  search: FeedDto;
}

/** Pins a search to one board, or returns it to the checked-board rotation. */
export function SearchBoardSelect(props: SearchBoardSelectProps): ReactElement {
  const { search } = props;
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const change = useMakeChange();

  const pin = (domain: string): void => {
    const board = boards.find((b) => b.domain === domain);
    const summary = board
      ? `Pinned ${search.name} to ${board.name}`
      : `Returned ${search.name} to the board rotation`;
    change.mutate({
      summary,
      actions: [{ type: "search.update", searchId: search.id, board: board?.domain ?? null }],
    });
  };

  return (
    <TextField
      select
      size="small"
      label="Board"
      value={search.board?.domain ?? ROTATE}
      disabled={change.isPending}
      onChange={(e) => pin(e.target.value)}
      sx={{ maxWidth: 320 }}
    >
      <MenuItem value={ROTATE}>Rotate checked boards</MenuItem>
      {boards.map((board) => (
        <MenuItem key={board.id} value={board.domain}>
          {board.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
