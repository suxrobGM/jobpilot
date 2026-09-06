import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

/** Placeholder for an auth form whose shape depends on the URL: one field over a button. */
export function AuthFormSkeleton(): ReactElement {
  return (
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={42} />
    </Stack>
  );
}
