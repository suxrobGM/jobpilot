import type { ReactElement } from "react";
import { Box, IconButton, type IconButtonProps, Tooltip } from "@mui/material";

interface TooltipIconButtonProps extends IconButtonProps {
  title: string;
}

export function TooltipIconButton(props: TooltipIconButtonProps): ReactElement {
  const { title, disabled, "aria-label": ariaLabel, ...rest } = props;
  const button = <IconButton disabled={disabled} aria-label={ariaLabel ?? title} {...rest} />;

  // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
  if (disabled) {
    return (
      <Tooltip title={title}>
        <Box component="span" sx={{ display: "inline-flex" }}>
          {button}
        </Box>
      </Tooltip>
    );
  }

  return <Tooltip title={title}>{button}</Tooltip>;
}
