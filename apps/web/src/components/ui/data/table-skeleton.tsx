import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";
import { slotKeys } from "@/utils/array";

const ROW_KEYS = slotKeys(8);

/** Placeholder for a table whose contents depend on the URL. */
export function TableSkeleton(): ReactElement {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rounded" height={40} />
      {ROW_KEYS.map((key) => (
        <Skeleton key={key} variant="rounded" height={52} />
      ))}
    </Stack>
  );
}
