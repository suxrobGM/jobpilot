import type { ReactElement } from "react";
import { Box, Tooltip, type TooltipProps } from "@mui/material";

export type TooltipPlacement = Pick<TooltipProps, "placement" | "arrow">;

interface DisabledSafeTooltipProps extends TooltipPlacement {
  title: string;
  disabled: boolean | undefined;
  children: ReactElement;
}

export function DisabledSafeTooltip(props: DisabledSafeTooltipProps): ReactElement {
  const { title, disabled, placement, arrow, children } = props;

  // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
  const anchor = disabled ? (
    <Box component="span" sx={{ display: "inline-flex" }}>
      {children}
    </Box>
  ) : (
    children
  );

  return (
    <Tooltip title={title} placement={placement} arrow={arrow}>
      {anchor}
    </Tooltip>
  );
}
