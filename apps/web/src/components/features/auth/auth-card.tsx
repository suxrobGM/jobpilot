import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";

interface AuthCardProps extends PropsWithChildren {
  title: string;
  /** A node lets a page stream a URL-dependent subtitle without blocking the card. */
  subtitle?: ReactNode;
}

/**
 * Centered, full-height frame for the unauthenticated login/register screens.
 * Renders the JobPilot wordmark above a single card so both pages share one
 * look without pulling in the app rail/shell.
 */
export function AuthCard(props: AuthCardProps): ReactElement {
  const { title, subtitle, children } = props;
  return (
    <Box
      sx={{
        minHeight: "100vh",
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
            <Typography variant="h1" sx={{ fontSize: "2rem", letterSpacing: "-0.035em" }}>
              JobPilot
            </Typography>
            <Typography variant="body2Muted">
              Your autonomous copilot for the whole job search
            </Typography>
          </Stack>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={3}>
                <Stack spacing={0.5}>
                  <Typography variant="h3" component="h2">
                    {title}
                  </Typography>
                  {subtitle && (
                    <Typography variant="body2Muted" component="div">
                      {subtitle}
                    </Typography>
                  )}
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
