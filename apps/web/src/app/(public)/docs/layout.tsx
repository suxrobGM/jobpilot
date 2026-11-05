import type { ReactElement, ReactNode } from "react";
import { Box, Container } from "@mui/material";
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
      <Box
        sx={{
          display: "grid",
          // minmax(0, ...), not 1fr: on xs the nowrap sidebar pills' min-content widens the page.
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "200px minmax(0, 720px)" },
          gap: { xs: 3, md: 8 },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0, position: { md: "sticky" }, top: { md: 88 } }}>
          <DocsSidebar />
        </Box>
        <Box component="article" sx={{ minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Container>
  );
}
