import type { ReactElement } from "react";
import { Grid, Skeleton } from "@mui/material";

/** Keyed by name, not index: Biome's `noArrayIndexKey` is on. */
const SLOTS = ["a", "b", "c", "d", "e", "f"];

/** The fallback for the streamed job grid. */
export function JobGridSkeleton(): ReactElement {
  return (
    <Grid container spacing={2}>
      {SLOTS.map((slot) => (
        <Grid key={slot} size={{ xs: 12, sm: 6, md: 4 }}>
          <Skeleton variant="rounded" height={180} />
        </Grid>
      ))}
    </Grid>
  );
}
