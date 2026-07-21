import type { ReactElement, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface LabelValueProps {
  label: string;
  children: ReactNode;
  row?: boolean;
}

export function LabelValue(props: LabelValueProps): ReactElement {
  const { label, children, row } = props;

  // Plain strings get the standard body2 value treatment; richer nodes render untouched.
  const value =
    typeof children === "string" ? <Typography variant="body2">{children}</Typography> : children;

  if (row) {
    return (
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="overlineMuted">{label}</Typography>
        {value}
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="overlineMuted">{label}</Typography>
      {value}
    </Box>
  );
}
