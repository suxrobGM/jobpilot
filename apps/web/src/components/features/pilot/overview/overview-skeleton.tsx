import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

/** Keyed by name, not index: Biome's `noArrayIndexKey` is on. */
const CARD_SLOTS = ["attention", "agenda", "activity"];

/** Mirrors the loaded overview: checklist bar, full-width hero, then the cards. */
export function OverviewSkeleton(): ReactElement {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={72} />
      <Skeleton variant="rounded" height={180} />
      {CARD_SLOTS.map((slot) => (
        <Skeleton key={slot} variant="rounded" height={140} />
      ))}
    </Stack>
  );
}
