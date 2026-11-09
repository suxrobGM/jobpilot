"use client";

import { type ReactElement, type ReactNode, useEffect } from "react";
import { Container } from "@mui/material";
import { type PageWidth, useTopBarSlots } from "./top-bar-slots";

interface PageShellProps {
  maxWidth?: PageWidth;
  children: ReactNode;
}

export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "lg", children } = props;
  const { setPageWidth } = useTopBarSlots();

  // Next hides a cached page by running this cleanup, so only the shown page sets it.
  useEffect(() => {
    setPageWidth(maxWidth);
    return () => setPageWidth(null);
  }, [maxWidth, setPageWidth]);

  return (
    <Container maxWidth={maxWidth} sx={{ gap: 2, py: { xs: 2, sm: 3 } }}>
      {children}
    </Container>
  );
}
