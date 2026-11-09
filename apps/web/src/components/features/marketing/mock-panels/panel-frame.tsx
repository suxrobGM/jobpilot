import type { ReactElement, ReactNode } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";

const TRAFFIC_LIGHTS = ["error.main", "warning.main", "success.main"] as const;

interface WindowBarProps {
  label: string;
}

/** A desktop window's title bar: traffic lights and a mono label. */
export function WindowBar(props: WindowBarProps): ReactElement {
  const { label } = props;
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        paddingInline: 1.5,
        paddingBlock: 1,
        borderBottom: 1,
        borderColor: "line.divider",
        backgroundColor: "surfaces.elevated",
      }}
    >
      {TRAFFIC_LIGHTS.map((color) => (
        <Box
          key={color}
          sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }}
        />
      ))}
      <Typography variant="monoCaption" sx={{ pl: 1 }}>
        {label}
      </Typography>
    </Stack>
  );
}

interface PanelFrameProps {
  label: string;
  children: ReactNode;
}

export function PanelFrame(props: PanelFrameProps): ReactElement {
  const { label, children } = props;
  return (
    <Card aria-hidden variant="showcase">
      <WindowBar label={label} />
      <Box sx={{ padding: 2 }}>{children}</Box>
    </Card>
  );
}
