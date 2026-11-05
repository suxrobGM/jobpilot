import type { ReactElement } from "react";
import { Box, LinearProgress } from "@mui/material";

export default function Loading(): ReactElement {
  return (
    // Above the rail and the agent drawer, which sit at drawer height.
    <Box sx={{ position: "sticky", top: 0, zIndex: "modal" }}>
      <LinearProgress />
    </Box>
  );
}
