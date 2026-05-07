import { Container, type ContainerProps, Stack } from "@mui/material";
import type { PropsWithChildren, ReactElement } from "react";

interface PageShellProps extends PropsWithChildren {
  maxWidth?: ContainerProps["maxWidth"];
  spacing?: number;
}

/**
 * Standard page wrapper: padded Container + vertical Stack. Default size
 * is "md" — dashboards override with "lg", the applications list with "xl".
 */
export function PageShell(props: PageShellProps): ReactElement {
  const { maxWidth = "md", spacing = 3, children } = props;
  return (
    <Container maxWidth={maxWidth} sx={{ py: 4 }}>
      <Stack spacing={spacing}>{children}</Stack>
    </Container>
  );
}
