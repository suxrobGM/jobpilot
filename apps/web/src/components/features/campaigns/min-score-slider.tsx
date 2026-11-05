"use client";

import type { ReactElement } from "react";
import { Slider, Stack, Typography } from "@mui/material";

interface MinScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function MinScoreSlider(props: MinScoreSliderProps): ReactElement {
  const { value, onChange } = props;
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2Muted">Min match score: {value}</Typography>
      <Slider
        value={value}
        min={0}
        max={100}
        step={5}
        marks
        valueLabelDisplay="auto"
        onChange={(_, v) => onChange(v as number)}
      />
    </Stack>
  );
}
