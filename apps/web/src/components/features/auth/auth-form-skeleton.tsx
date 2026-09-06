import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

const FIELD_KEYS = ["primary", "secondary"] as const;

interface AuthFormSkeletonProps {
  /** Input rows to stand in for, matching the form being streamed. Max 2. */
  fields?: number;
}

/** Placeholder for an auth form whose shape depends on the URL. */
export function AuthFormSkeleton(props: AuthFormSkeletonProps): ReactElement {
  const { fields = 2 } = props;
  return (
    <Stack spacing={2.5}>
      {FIELD_KEYS.slice(0, fields).map((key) => (
        <Skeleton key={key} variant="rounded" height={56} />
      ))}
      <Skeleton variant="rounded" height={42} />
    </Stack>
  );
}
