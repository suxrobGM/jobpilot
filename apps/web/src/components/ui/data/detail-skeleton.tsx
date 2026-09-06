import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";
import { slotKeys } from "@/utils/array";

interface DetailSkeletonProps {
  /** One bar per height, top to bottom. Defaults to a header above a body panel. */
  heights?: number[];
}

/** Placeholder for a detail page whose header and body stream as one piece. */
export function DetailSkeleton(props: DetailSkeletonProps): ReactElement {
  const { heights = [72, 420] } = props;
  return (
    <Stack spacing={3}>
      {slotKeys(heights.length).map((key, index) => (
        <Skeleton key={key} variant="rounded" height={heights[index]} />
      ))}
    </Stack>
  );
}
