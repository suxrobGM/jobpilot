import type { ReactElement } from "react";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { accent, gradients, radii } from "@/theme";
import { Section } from "../section";

// A server component, so sx must stay a plain object - a `(theme) => …` callback
// is a function, and functions cannot cross the RSC boundary.
const emberWash = `radial-gradient(ellipse 45% 90% at 10% -15%, ${alpha(accent.primary, 0.2)}, transparent 50%)`;

export function CtaBand(): ReactElement {
  return (
    <Section>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: `${radii.lg}px`,
          border: `1px solid ${accent.primary}40`,
          backgroundColor: "surfaces.card",
          boxShadow: `0 24px 64px -32px ${accent.primary}33`,
          paddingBlock: { xs: 6, md: 8 },
          paddingInline: { xs: 3, md: 6 },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: gradients.reversed,
            opacity: 0.05,
            pointerEvents: "none",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: emberWash,
            pointerEvents: "none",
          }}
        />
        <Stack spacing={3} sx={{ position: "relative", alignItems: "flex-start" }}>
          <Typography variant="displayMd" sx={{ maxWidth: 620 }}>
            Put your job search on autopilot.
          </Typography>
          <Typography variant="body1Muted" sx={{ fontSize: "0.9375rem", maxWidth: 520 }}>
            Install the agent, create an account, run your first campaign tonight.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <LinkButton href="/install" variant="contained" size="large">
              Get started
            </LinkButton>
            <LinkButton href="/docs" variant="outlined" size="large">
              Read the docs
            </LinkButton>
          </Stack>
        </Stack>
      </Box>
    </Section>
  );
}
