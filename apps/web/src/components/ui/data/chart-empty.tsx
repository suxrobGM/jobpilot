import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";

interface ChartEmptyProps {
  message: string;
  height: number;
}

/** Holds the chart's height so an empty card lines up with its filled neighbours. */
export function ChartEmpty(props: ChartEmptyProps): ReactElement {
  const { message, height } = props;
  return (
    <Stack sx={{ minHeight: height, alignItems: "center", justifyContent: "center" }}>
      <Typography variant="captionMuted">{message}</Typography>
    </Stack>
  );
}
