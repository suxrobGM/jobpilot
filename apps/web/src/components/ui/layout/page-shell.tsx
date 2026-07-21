import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";

interface PageShellProps {
  maxWidth?: "md" | "lg" | "xl";
  children: ReactNode;
}

export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "lg", children } = props;
  // Container is a global flex column (containerOverrides); gap 2 is the standard page rhythm.
  return (
    <Container maxWidth={maxWidth} sx={{ gap: 2 }}>
      {children}
    </Container>
  );
}
