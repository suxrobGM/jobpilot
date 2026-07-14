import type { ReactElement } from "react";
import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { Section } from "../section";
import { SectionEyebrow } from "../section-eyebrow";

const FACTS = [
  {
    title: "Your subscription",
    body: "The agent runs on your Claude or Codex plan. JobPilot ships no model keys and adds no per-job fees.",
  },
  {
    title: "Your machine",
    body: "The terminal and browser run locally. Watch every action in the agent dock; stop it whenever you like.",
  },
  {
    title: "Encrypted credentials",
    body: "Board logins and captcha keys are encrypted with a key only your account holds. Deleting your account destroys it.",
  },
  {
    title: "Your own Gmail client",
    body: "Email runs through your personal Google OAuth client. No shared app sits between JobPilot and your mail.",
  },
];

export function PrivacyGrid(): ReactElement {
  return (
    <Section>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <SectionEyebrow>TRUST</SectionEyebrow>
        <Typography variant="h2">Your keys stay yours.</Typography>
      </Stack>
      <Grid container spacing={2}>
        {FACTS.map((fact) => (
          <Grid key={fact.title} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h3" sx={{ fontSize: "1.05rem" }}>
                    {fact.title}
                  </Typography>
                  <Typography variant="body2Muted">{fact.body}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}
