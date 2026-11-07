import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";

export const PAGE_WIDTHS = ["md", "lg", "xl"] as const;

/** The TopBar reads this to line its title and buttons up with the page. */
export const PAGE_WIDTH_ATTR = "data-page-width";

interface PageShellProps {
  maxWidth?: (typeof PAGE_WIDTHS)[number];
  children: ReactNode;
}

export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "lg", children } = props;
  return (
    <Container
      maxWidth={maxWidth}
      {...{ [PAGE_WIDTH_ATTR]: maxWidth }}
      sx={{ gap: 2, py: { xs: 2, sm: 3 } }}
    >
      {children}
    </Container>
  );
}
