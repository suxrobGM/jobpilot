import type { ReactElement, ReactNode } from "react";
import { Container, Grid } from "@mui/material";
import { DocsBreadcrumbJsonLd, DocsSidebar } from "@/components/features/docs";

export const ensureStatic = "navigation";

interface DocsLayoutProps {
  children: ReactNode;
}

export default function DocsLayout(props: DocsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <Container component="main" maxWidth="lg" sx={{ flex: 1, paddingBlock: { xs: 3, md: 6 } }}>
      <DocsBreadcrumbJsonLd />
      <Grid container spacing={{ xs: 3, md: 8 }} sx={{ alignItems: "flex-start" }}>
        {/* minWidth 0: on xs the nowrap sidebar pills' min-content would widen the page. */}
        <Grid
          size={{ xs: 12, md: "auto" }}
          sx={{ width: { md: 200 }, minWidth: 0, position: { md: "sticky" }, top: { md: 88 } }}
        >
          <DocsSidebar />
        </Grid>
        <Grid
          component="article"
          size={{ xs: 12, md: "grow" }}
          sx={{ minWidth: 0, maxWidth: { md: 720 } }}
        >
          {children}
        </Grid>
      </Grid>
    </Container>
  );
}
