import type { ReactElement, ReactNode } from "react";
import { Clear } from "@mui/icons-material";
import { Box, Button, Stack } from "@mui/material";

interface FilterBarProps {
  hasFilters: boolean;
  onClear: () => void;
  /** Right-aligned: counts and bulk actions. */
  end?: ReactNode;
  children: ReactNode;
}

/** The filter row above a list: filters, a Clear button while any is set, then `end`. */
export function FilterBar(props: FilterBarProps): ReactElement {
  const { hasFilters, onClear, end, children } = props;

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
    >
      {children}
      {hasFilters && (
        <Button size="small" variant="text" startIcon={<Clear fontSize="sm" />} onClick={onClear}>
          Clear
        </Button>
      )}
      {end && (
        <>
          <Box sx={{ flex: 1 }} />
          {end}
        </>
      )}
    </Stack>
  );
}
