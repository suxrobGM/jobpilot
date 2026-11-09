"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { Clear, Tune } from "@mui/icons-material";
import { Badge, Box, Button, Drawer, Stack, Typography, useMediaQuery } from "@mui/material";

interface FilterBarProps {
  hasFilters: boolean;
  onClear: () => void;
  /** Leads the bar; stays in it on phones while the filters move to a sheet. */
  search?: ReactNode;
  /** Right-aligned: the count, or an action that belongs to the list. */
  end?: ReactNode;
  children: ReactNode;
}

/** The toolbar above a list: search, filters, Clear while any is set, then `end` on the right. */
export function FilterBar(props: FilterBarProps): ReactElement {
  const { hasFilters, onClear, search, end, children } = props;
  const phone = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const [sheetOpen, setSheetOpen] = useState(false);

  const clearButton = hasFilters && (
    <Button size="small" variant="text" startIcon={<Clear fontSize="sm" />} onClick={onClear}>
      Clear
    </Button>
  );

  if (!phone) {
    return (
      <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {search}
        {children}
        {clearButton}
        {end && (
          <>
            <Box sx={{ flex: 1 }} />
            {end}
          </>
        )}
      </Stack>
    );
  }

  // Phones: one row, so the stacked filters don't push the list below the fold.
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {search && <Box sx={{ flex: 1, minWidth: 0 }}>{search}</Box>}
        <Badge color="primary" variant="dot" invisible={!hasFilters}>
          <Button
            variant="outlined"
            startIcon={<Tune fontSize="sm" />}
            onClick={() => setSheetOpen(true)}
          >
            Filters
          </Button>
        </Badge>
        {!search && <Box sx={{ flex: 1 }} />}
        {end}
      </Stack>
      <Drawer anchor="bottom" open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h4" component="h2">
              Filters
            </Typography>
            {clearButton}
          </Stack>
          <Stack spacing={1.5} sx={{ "& .MuiTextField-root": { width: "100%" } }}>
            {children}
          </Stack>
          <Button variant="contained" onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
