import type { ReactElement } from "react";
import { Box, Card, CardContent, Grid, Link, Stack, Typography } from "@mui/material";
import { accent, feedback, fontFamilies } from "@/theme";
import { panelCellSx } from "../mock-panels/panel-frame";
import { Section } from "../section";
import { SectionEyebrow } from "../section-eyebrow";

interface Mode {
  tag: string;
  title: string;
  body: string;
  action: string;
  tone: "info" | "accent" | "success" | "warning";
}

const MODES: Mode[] = [
  {
    tag: "search",
    title: "Search",
    body: "Find and score roles against your resume across every board.",
    action: "New campaign → Search only",
    tone: "info",
  },
  {
    tag: "auto-apply",
    title: "Auto-apply",
    body: "Let the agent apply to your high-match roles on its own.",
    action: "New campaign → Auto-apply",
    tone: "accent",
  },
  {
    tag: "apply",
    title: "Apply",
    body: "Paste job links and the agent applies one by one, tailored each time.",
    action: "New campaign → Apply to links",
    tone: "success",
  },
  {
    tag: "networking",
    title: "Networking",
    body: "Find the hiring manager and message them by email or LinkedIn.",
    action: "New campaign → Networking",
    tone: "warning",
  },
];

const toneColor = (tone: Mode["tone"]): string =>
  tone === "accent" ? accent.primary : feedback[tone];

export function CampaignTypes(): ReactElement {
  return (
    <Section>
      <Stack spacing={1.5} sx={{ mb: 4, maxWidth: 620 }}>
        <SectionEyebrow>HANDS-ON MODES</SectionEyebrow>
        <Typography variant="h2">Four modes for driving it yourself.</Typography>
        <Typography variant="body1Muted" sx={{ fontSize: "0.9375rem" }}>
          The Pilot runs all of these for you. Reach for them yourself when you want to steer a
          single search, application, or message.
        </Typography>
      </Stack>
      <Grid container spacing={2}>
        {MODES.map((mode) => {
          const tone = toneColor(mode.tone);
          return (
            <Grid key={mode.tag} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: "100%",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: `${tone}80`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px -16px ${tone}59`,
                  },
                }}
              >
                <CardContent
                  sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                  <Box
                    component="span"
                    sx={{
                      alignSelf: "flex-start",
                      fontFamily: fontFamilies.mono,
                      fontSize: "0.7rem",
                      color: tone,
                      borderLeft: 2,
                      borderColor: tone,
                      pl: 1,
                    }}
                  >
                    {mode.tag}
                  </Box>
                  <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
                    {mode.title}
                  </Typography>
                  <Typography variant="body2Muted">{mode.body}</Typography>
                  <Box
                    component="code"
                    sx={[
                      panelCellSx,
                      {
                        mt: "auto",
                        px: 1,
                        py: 0.5,
                        fontFamily: fontFamilies.mono,
                        fontSize: "0.7rem",
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    ]}
                  >
                    {mode.action}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Typography variant="body2Muted" sx={{ mt: 3 }}>
        Each one starts from a button in the dashboard and runs in the agent dock.{" "}
        <Link href="/docs/campaigns-and-skills">See the docs</Link>.
      </Typography>
    </Section>
  );
}
