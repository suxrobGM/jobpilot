import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import type { PortfolioDto } from "@/api/types";

interface AvailabilityBadgeProps {
  availability: PortfolioDto["availability"];
}

/** "Open to work" pill; renders nothing unless the user is actively open. */
export function AvailabilityBadge(props: AvailabilityBadgeProps): ReactNode {
  if (props.availability !== "open") return null;
  return <Chip label="Open to work" color="success" variant="outlined" />;
}
