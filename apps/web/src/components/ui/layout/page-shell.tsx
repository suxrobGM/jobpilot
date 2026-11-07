import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";

interface PageShellProps {
  maxWidth?: "md" | "lg" | "xl";
  children: ReactNode;
}

export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "lg", children } = props;
  return (
    <Container maxWidth={maxWidth} sx={{ gap: 2, py: { xs: 2, sm: 3 } }}>
      {children}
    </Container>
  );
}
