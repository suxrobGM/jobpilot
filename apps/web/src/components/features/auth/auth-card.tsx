import type { PropsWithChildren, ReactElement } from "react";
import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";

interface AuthCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function AuthCard(props: AuthCardProps): ReactElement {
  const { title, subtitle, children } = props;
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "surfaces.base",
        py: 6,
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={3}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <JobPilotMark size={48} />
            <Typography variant="h2" component="h1">
              JobPilot
            </Typography>
            <Typography variant="body2Muted">An AI agent that applies to jobs for you</Typography>
          </Stack>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={3}>
                <Stack spacing={0.5}>
                  <Typography variant="h3" component="h2">
                    {title}
                  </Typography>
                  {subtitle && <Typography variant="body2Muted">{subtitle}</Typography>}
                </Stack>
                {children}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
