"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Clear, Search } from "@mui/icons-material";
import { Box, Button, InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { JobBoardDto as JobBoard } from "@/api/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePipelineFilters } from "../hooks/use-pipeline-filters";

const SEARCH_DEBOUNCE_MS = 250;

export function PipelineFilterBar(): ReactElement {
  const { search, setSearch, board, setBoard, isAnyActive, clearAll } = usePipelineFilters();

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

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.25}
      sx={{ alignItems: { xs: "stretch", md: "center" }, width: "100%" }}
    >
      <TextField
        size="small"
        placeholder="Search role, company, URL"
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
