import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";
import { slotKeys } from "@/utils/array";

interface AuthFormSkeletonProps {
  /** Input rows to stand in for, matching the form being streamed. */
  fields?: number;
}

/** Placeholder for an auth form whose shape depends on the URL. */
export function AuthFormSkeleton(props: AuthFormSkeletonProps): ReactElement {
  const { fields = 2 } = props;
  return (
    <Stack spacing={2.5}>
      {slotKeys(fields).map((key) => (
        <Skeleton key={key} variant="rounded" height={56} />
      ))}
      <Skeleton variant="rounded" height={42} />
    </Stack>
  );
}
