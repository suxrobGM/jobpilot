import type { ReactElement } from "react";
import { Grid, Skeleton, Stack } from "@mui/material";

/** Keyed by name, not index: Biome's `noArrayIndexKey` is on. */
const CARD_SLOTS = ["attention", "agenda", "activity"];

/** Mirrors the loaded overview: checklist bar, 7/5 hero, then the full-width cards. */
export function OverviewSkeleton(): ReactElement {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rectangular" height={72} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Skeleton variant="rectangular" height={180} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Skeleton variant="rectangular" height={180} />
        </Grid>
      </Grid>
      {CARD_SLOTS.map((slot) => (
        <Skeleton key={slot} variant="rectangular" height={140} />
      ))}
    </Stack>
  );
}
