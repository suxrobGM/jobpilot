import { Box, Container, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";

export default function HomePage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overlineMuted">JobPilot</Typography>
          <Typography variant="h1" sx={{ mt: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body1Muted" sx={{ mt: 1 }}>
            Web app scaffold is up. Profile, applications, runs, and batch
            management arrive in the next phases.
          </Typography>
        </Box>
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="overline">Health check</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <code>GET /api/health</code> returns{" "}
            <code>{"{ ok: true, version }"}</code>.
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
