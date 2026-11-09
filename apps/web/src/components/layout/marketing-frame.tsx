import type { ReactElement, ReactNode } from "react";
import { Box, Container } from "@mui/material";
import type { Breakpoint } from "@mui/material/styles";
import { MarketingFooter, MarketingNav } from "@/components/features/marketing";

interface MarketingFrameProps {
  children: ReactNode;
}

/** Nav and footer around every public page - acquisition surfaces, not the app. */
export function MarketingFrame(props: MarketingFrameProps): ReactElement {
  const { children } = props;
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "surfaces.base",
        // Decorative glows must never widen the page on mobile.
        overflowX: "clip",
      }}
    >
      <MarketingNav />
      {children}
      <MarketingFooter />
    </Box>
  );
}

interface MarketingMainProps {
  /** Matches the page's content: "lg" for lists, "md" for a single column. */
  maxWidth: Breakpoint;
  children: ReactNode;
}

export function MarketingMain(props: MarketingMainProps): ReactElement {
  const { maxWidth, children } = props;
  return (
    <Container
      component="main"
      maxWidth={maxWidth}
      sx={{ flex: 1, paddingBlock: { xs: 4, md: 6 } }}
    >
      {children}
    </Container>
  );
}
