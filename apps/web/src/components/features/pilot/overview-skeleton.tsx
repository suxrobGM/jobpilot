import type { ReactElement } from "react";
import { Skeleton, Stack } from "@mui/material";

/** Keyed by name, not index: Biome's `noArrayIndexKey` is on. */
const CARD_SLOTS = ["attention", "agenda", "activity"];

/** Mirrors the loaded overview: checklist bar, full-width hero, then the cards. */
export function OverviewSkeleton(): ReactElement {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rectangular" height={72} />
      <Skeleton variant="rectangular" height={180} />
      {CARD_SLOTS.map((slot) => (
        <Skeleton key={slot} variant="rectangular" height={140} />
      ))}
    </Stack>
  );
}
