import type { ReactElement, ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface LabelValueProps {
  label: string;
  children: ReactNode;
}

export function LabelValue(props: LabelValueProps): ReactElement {
  const { label, children } = props;

  // Plain strings get the standard body2 value treatment; richer nodes render untouched.
  const value =
    typeof children === "string" ? <Typography variant="body2">{children}</Typography> : children;

  return (
    <Box>
      <Typography variant="overlineMuted">{label}</Typography>
      {value}
    </Box>
  );
}
