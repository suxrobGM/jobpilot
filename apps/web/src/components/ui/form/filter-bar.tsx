import type { ReactElement, ReactNode } from "react";
import { Clear } from "@mui/icons-material";
import { Box, Button, Stack } from "@mui/material";

interface FilterBarProps {
  hasFilters: boolean;
  onClear: () => void;
  /** Right-aligned: the count, or an action that belongs to the list. */
  end?: ReactNode;
  children: ReactNode;
}

/** The toolbar above a list: filters, Clear while any is set, then `end` on the right. */
export function FilterBar(props: FilterBarProps): ReactElement {
  const { hasFilters, onClear, end, children } = props;

  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
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
