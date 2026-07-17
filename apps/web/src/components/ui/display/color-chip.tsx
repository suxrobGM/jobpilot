import type { ReactElement } from "react";
import { Chip, type ChipProps } from "@mui/material";

interface ColorChipProps<T extends string> {
  value: T;
  colors: Readonly<Record<T, ChipProps["color"]>>;
  /** Defaults to the raw value. */
  label?: string;
  size?: ChipProps["size"];
  variant?: ChipProps["variant"];
  sx?: ChipProps["sx"];
}

export function ColorChip<T extends string>(props: ColorChipProps<T>): ReactElement {
  const { value, colors, label, size = "small", variant = "outlined", sx } = props;
  return (
    <Chip size={size} variant={variant} label={label ?? value} color={colors[value]} sx={sx} />
  );
}
