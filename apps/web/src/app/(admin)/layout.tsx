import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AdminTabs } from "@/components/features/admin";
import { AppShell } from "@/components/layout";
import { PageHeader, PageShell } from "@/components/ui/layout";

/** Own group, but keeps AppShell: an admin is still a normal user, so Workspace stays a click away. */
export default function AdminLayout(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <AppShell>
      <Box sx={{ minHeight: "100%", display: "flex", flexDirection: "column", py: 3 }}>
        <PageShell maxWidth="lg">
          <PageHeader
            eyebrow="Platform"
            title="Admin"
            description="Users, platform activity, and the shared board catalog."
          />
          <AdminTabs />
          {children}
        </PageShell>
      </Box>
    </AppShell>
  );
}
