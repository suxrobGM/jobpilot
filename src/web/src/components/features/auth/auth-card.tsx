import type { PropsWithChildren, ReactElement } from "react";
import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";

interface AuthCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
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
      sx={(theme) => ({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.palette.surfaces.base,
        py: 6,
      })}
    >
      <Container maxWidth="xs">
        <Stack spacing={3}>
          <Stack spacing={0.5} sx={{ textAlign: "center" }}>
            <Typography
              variant="h1"
              sx={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontStyle: "italic",
                fontSize: "2rem",
              }}
            >
              JobPilot
            </Typography>
            <Typography variant="body2Muted">
              Your local control center for AI-driven job applications
            </Typography>
          </Stack>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={3}>
                <Stack spacing={0.5}>
                  <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
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
