"use client";

import { useEffect, useState, type ChangeEvent, type ReactElement } from "react";
import { Clear, Search } from "@mui/icons-material";
import { Box, Button, InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import type { JobBoard } from "@/generated/prisma/client";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { usePipelineFilters } from "./use-pipeline-filters";

const SEARCH_DEBOUNCE_MS = 250;

export function PipelineFilterBar(): ReactElement {
  const { search, setSearch, board, setBoard, matchMin, setMatchMin, isAnyActive, clearAll } =
    usePipelineFilters();

  const [searchDraft, setSearchDraft] = useState(search ?? "");
  const debouncedSearch = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== search) {
      setSearch(next);
    }
  }, [debouncedSearch, search, setSearch]);

  const boards = useApiQuery<JobBoard[]>(queryKeys.jobBoards.list(), () =>
    apiClient.get<JobBoard[]>("/api/job-boards"),
  );

  const handleMatchMinChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    if (raw === "") {
      setMatchMin(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setMatchMin(Math.max(0, Math.min(100, parsed)));
  };

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.25}
      sx={{ alignItems: { xs: "stretch", md: "center" }, width: "100%" }}
    >
      <TextField
        size="small"
        placeholder="Search role, company, URL…"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="sm" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: 1, minWidth: 200 }}
      />

      <TextField
        size="small"
        select
        label="Board"
        value={board ?? ""}
        onChange={(e) => setBoard(e.target.value === "" ? null : e.target.value)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All boards</MenuItem>
        {boards.data?.map((b) => (
          <MenuItem key={b.id} value={b.name}>
            {b.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        size="small"
        type="number"
        label="Min match"
        value={matchMin ?? ""}
        onChange={handleMatchMinChange}
        slotProps={{
          htmlInput: { min: 0, max: 100, step: 5 },
          input: {
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          },
        }}
        sx={{ width: 120 }}
      />

      <Box sx={{ flexGrow: 0 }}>
        {isAnyActive && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={() => {
              setSearchDraft("");
              clearAll();
            }}
          >
            Clear
          </Button>
        )}
      </Box>
    </Stack>
  );
}
