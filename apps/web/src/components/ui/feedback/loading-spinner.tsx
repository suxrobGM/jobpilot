import type { ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";

interface LoadingSpinnerProps {
  /** Spinner diameter in px. */
  size?: number;
  /** Vertical padding in theme spacing units. */
  py?: number;
}

/** Horizontally-centered spinner for in-card / in-section loading states. */
export function LoadingSpinner(props: LoadingSpinnerProps): ReactElement {
  const { size = 24, py = 4 } = props;
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py }}>
      <CircularProgress size={size} />
    </Box>
  );
}
