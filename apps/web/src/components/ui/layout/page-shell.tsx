import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";

interface PageShellProps {
  maxWidth?: "md" | "lg" | "xl";
  children: ReactNode;
}

/** Left-aligned, so the content's edge lines up with the title in the top bar. */
export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "lg", children } = props;
  return (
    <Container maxWidth={maxWidth} sx={{ gap: 2, py: { xs: 2, sm: 3 }, mx: 0 }}>
      {children}
    </Container>
  );
}
