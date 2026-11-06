import type { ReactElement } from "react";
import { CheckRounded } from "@mui/icons-material";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { LinkButton } from "@/components/ui/buttons";
import { Glow } from "../glow";
import { AgentTranscript } from "./agent-transcript";

const PROMISES = ["No API key", "Claude Code or Codex"];

export function Hero(): ReactElement {
  return (
    <Box component="section" sx={{ position: "relative", overflow: "hidden" }}>
      <Glow placement="top" />
      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          paddingTop: { xs: 6, md: 10 },
          // Short bottom padding so the hero runs straight into the demo video.
          paddingBottom: { xs: 3, md: 4 },
        }}
      >
        <Grid container spacing={{ xs: 5, md: 8 }} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3} sx={{ alignItems: "flex-start" }}>
              <Typography variant="eyebrow" color="primary">
                Free · open source · runs on your computer
              </Typography>
              <Typography variant="displayLg" sx={{ textWrap: "balance" }}>
                An AI agent that applies to jobs for you.
              </Typography>
              <Typography variant="lead" sx={{ maxWidth: 540 }}>
                Tell the Pilot what you want and it finds jobs that fit, tailors your resume for
                each one, fills in the application, and writes to recruiters. It uses the Claude or
                Codex subscription you already have, and asks you when it needs a decision.
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
                <LinkButton href="/install" variant="contained" size="large">
                  Install the agent
                </LinkButton>
                <LinkButton href={"/#demo" as Route} variant="outlined" size="large">
                  Watch the demo
                </LinkButton>
              </Stack>
              <Stack direction="row" component="ul" sx={{ flexWrap: "wrap", gap: 2, m: 0, p: 0 }}>
                {PROMISES.map((promise) => (
                  <Stack
                    key={promise}
                    component="li"
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: "center", listStyle: "none" }}
                  >
                    <CheckRounded fontSize="sm" color="success" />
                    <Typography variant="captionMuted">{promise}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <AgentTranscript />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
