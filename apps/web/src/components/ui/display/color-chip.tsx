import type { ReactElement } from "react";
import { Chip, type ChipProps } from "@mui/material";

interface ColorChipProps<T extends string> {
  value: T;
  colors: Readonly<Record<T, ChipProps["color"]>>;
  /** Defaults to the raw value. */
  label?: string;
  size?: ChipProps["size"];
}

export function ColorChip<T extends string>(props: ColorChipProps<T>): ReactElement {
  const { value, colors, label, size = "small" } = props;
  return <Chip size={size} variant="outlined" label={label ?? value} color={colors[value]} />;
}
