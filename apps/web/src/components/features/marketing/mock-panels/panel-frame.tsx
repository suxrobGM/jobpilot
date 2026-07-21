import type { ReactElement, ReactNode } from "react";
import { Box, Stack, type SxProps, type Theme, Typography } from "@mui/material";
import { fontFamilies, line, radii, shadows } from "@/theme";

interface PanelFrameProps {
  /** Mono window-title label, e.g. "pipeline". */
  label: string;
  children: ReactNode;
}

/** Shared window chrome for the product-tour mock panels - same family as the hero transcript. */
export function PanelFrame(props: PanelFrameProps): ReactElement {
  const { label, children } = props;
  return (
    <Box
      aria-hidden
      sx={{
        borderRadius: radii.lg,
        border: `1px solid ${line.border}`,
        backgroundColor: "surfaces.card",
        boxShadow: shadows.lg,
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: "center",
          paddingInline: 1.5,
          height: 36,
          borderBottom: `1px solid ${line.divider}`,
          backgroundColor: "surfaces.elevated",
        }}
      >
        {(["error.main", "warning.main", "success.main"] as const).map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c }} />
        ))}
        <Typography variant="captionMuted" sx={{ fontFamily: fontFamilies.mono, pl: 1 }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ padding: 2 }}>{children}</Box>
    </Box>
  );
}

/** Inset-card surface shared by every mock panel; merge with a `padding` override. */
export const panelCellSx = {
  borderRadius: radii.sm,
  border: `1px solid ${line.divider}`,
  backgroundColor: "surfaces.elevated",
} satisfies SxProps<Theme>;

interface PanelBadgeProps {
  children: ReactNode;
  /** Text color; also the border color unless `borderColor` is set. */
  color: string;
  borderColor?: string;
  mono?: boolean;
  sx?: SxProps<Theme>;
}

/** The small outlined pill shared by the mock panels' status/marker chips. */
export function PanelBadge(props: PanelBadgeProps): ReactElement {
  const { children, color, borderColor, mono, sx } = props;
  return (
    <Box
      component="span"
      sx={[
        {
          fontSize: "0.625rem",
          fontWeight: mono ? 400 : 600,
          fontFamily: mono ? fontFamilies.mono : undefined,
          color,
          border: "1px solid",
          borderColor: borderColor ?? color,
          borderRadius: radii.pill,
          paddingInline: 1,
          paddingBlock: 0.25,
          whiteSpace: "nowrap",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
