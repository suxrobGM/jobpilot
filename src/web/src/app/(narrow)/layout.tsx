import type { PropsWithChildren, ReactElement } from "react";
import { Container } from "@mui/material";

export default function NarrowLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {children}
    </Container>
  );
}
