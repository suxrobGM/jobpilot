import type { ReactElement } from "react";
import { Box } from "@mui/material";
import { markDataUri } from "@/components/brand/mark-svg";

interface JobPilotMarkProps {
  /** Rendered width/height in px (the mark is square). */
  size?: number;
}

export function JobPilotMark(props: JobPilotMarkProps): ReactElement {
  const { size = 36 } = props;
  return (
    <Box
      component="img"
      src={markDataUri(size, { small: size < 48 })}
      alt=""
      aria-hidden
      sx={{ width: size, height: size, display: "block" }}
    />
  );
}
