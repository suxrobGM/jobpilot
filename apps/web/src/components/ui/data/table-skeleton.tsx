import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

const ROW_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;

interface TableSkeletonProps {
  /** Body rows to stand in for. Capped at 10. */
  rows?: number;
}

/** Placeholder for a table whose contents depend on the URL. */
export function TableSkeleton(props: TableSkeletonProps): ReactElement {
  const { rows = 8 } = props;
  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={40} />
      {ROW_KEYS.slice(0, rows).map((key) => (
        <Skeleton key={key} variant="rounded" height={52} />
      ))}
    </Stack>
  );
}
