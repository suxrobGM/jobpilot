import type { ReactElement } from "react";
import { Box } from "@mui/material";

interface CountLabelProps {
  label: string;
  /** Omitted while the count loads, so the label doesn't jump when it arrives. */
  count?: number | null;
}

/** A tab or filter label with its count in mono beside it: "Applied 303". */
export function CountLabel(props: CountLabelProps): ReactElement {
  const { label, count } = props;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75 }}>
      {label}
      {count !== undefined && count !== null && (
        <Box component="span" sx={{ typography: "monoCaption", color: "text.secondary" }}>
          {count}
        </Box>
      )}
    </Box>
  );
}
