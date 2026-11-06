import type { ReactElement, ReactNode } from "react";
import { Box } from "@mui/material";
import { type SectionAnchor, SectionAnchorNav } from "./section-anchor-nav";

interface SectionLayoutProps {
  anchors: SectionAnchor[];
  /** "end" when the page already has a nav column on the left. */
  railSide?: "start" | "end";
  children: ReactNode;
}

/** Sticky rail beside a column of `data-section-id` blocks; hidden below `lg`, where they stack. */
export function SectionLayout(props: SectionLayoutProps): ReactElement {
  const { anchors, railSide = "start", children } = props;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", lg: railSide === "end" ? "row-reverse" : "row" },
        gap: { xs: 2, sm: 3 },
        alignItems: "flex-start",
      }}
    >
      <SectionAnchorNav anchors={anchors} />
      <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>{children}</Box>
    </Box>
  );
}
