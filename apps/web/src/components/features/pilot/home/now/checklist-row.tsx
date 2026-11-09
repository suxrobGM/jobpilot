import type { ReactElement, ReactNode } from "react";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";

interface ChecklistRowProps {
  done: boolean;
  label: string;
  description?: string;
  /** Hidden once the step is done. */
  action?: ReactNode;
}

export function ChecklistRow(props: ChecklistRowProps): ReactElement {
  const { done, label, description, action } = props;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minHeight: 36 }}>
      {done ? (
        <CheckCircle fontSize="md" sx={{ color: "success.main" }} />
      ) : (
        <RadioButtonUnchecked fontSize="md" sx={{ color: "text.disabled" }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant={description ? "body1Strong" : "body1"}
          sx={done ? { color: "text.disabled" } : undefined}
        >
          {label}
        </Typography>
        {description && <Typography variant="captionMuted">{description}</Typography>}
      </Box>
      {!done && action}
    </Stack>
  );
}
