import type { ReactElement } from "react";
import { Box, LinearProgress } from "@mui/material";

export default function Loading(): ReactElement {
  return (
    <Box sx={{ position: "sticky", top: 0, zIndex: 1201 }}>
      <LinearProgress />
    </Box>
  );
}
