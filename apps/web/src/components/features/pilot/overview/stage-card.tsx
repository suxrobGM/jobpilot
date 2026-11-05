"use client";

import type { ReactElement } from "react";
import { EastRounded } from "@mui/icons-material";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";

export interface Stage {
  title: string;
  role: string;
  tone: PulseDotTone;
}

export const DIM_OPACITY = 0.5;

interface StageCardProps {
  stage: Stage;
  caption: string;
  active?: boolean;
  dimmed: boolean;
}

export function StageCard(props: StageCardProps): ReactElement {
  const { stage, caption, active = false, dimmed } = props;

  return (
    <Card
      variant={active ? "accent" : undefined}
      sx={{ flex: { md: "1 1 0" }, minWidth: 0, opacity: dimmed ? DIM_OPACITY : 1 }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PulseDot tone={dimmed ? "muted" : stage.tone} size="sm" pulsing={active} />
          <Typography variant="body1Strong">{stage.title}</Typography>
        </Stack>
        <Typography variant="overlineMuted" sx={{ display: "block", ml: 2 }}>
          {stage.role}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.75,
            ml: 2,
            color: active ? "text.primary" : "text.secondary",
          }}
        >
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface StageArrowProps {
  lit: boolean;
}

export function StageArrow(props: StageArrowProps): ReactElement {
  const { lit } = props;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        px: { md: 0.5 },
        py: { xs: 0.5, md: 0 },
        color: lit ? theme.palette.accent.primary : "text.disabled",
        transition: theme.transitions.create("color"),
      })}
    >
      <EastRounded fontSize="md" sx={{ transform: { xs: "rotate(90deg)", md: "none" } }} />
    </Box>
  );
}
