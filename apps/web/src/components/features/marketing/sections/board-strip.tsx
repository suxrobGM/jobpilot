import type { ReactElement } from "react";
import { Box, Container, Stack, Typography } from "@mui/material";
import { accent, fontFamilies, line, radii } from "@/theme";

const BOARDS = [
  "LinkedIn",
  "Indeed",
  "Glassdoor",
  "Wellfound",
  "Y Combinator",
  "Hiring Cafe",
  "Welcome to the Jungle",
  "HN Who's Hiring",
  "We Work Remotely",
  "Remote OK",
  "4 Day Week",
  "Upwork",
];

const chipSx = {
  fontFamily: fontFamilies.mono,
  fontSize: { xs: "0.75rem", md: "0.8125rem" },
  whiteSpace: "nowrap",
  paddingInline: 1.25,
  paddingBlock: 0.5,
  borderRadius: radii.pill,
} as const;

/**
 * The seeded boards as mono chips - the agent's territory, machine voice - with an
 * explicit "add your own" affordance: the agent drives a real browser, so the list
 * is a starting point, not a limit.
 */
export function BoardStrip(): ReactElement {
  return (
    <Box sx={{ borderBlock: 1, borderColor: "line.divider", backgroundColor: "surfaces.card" }}>
      <Container maxWidth="lg" sx={{ paddingBlock: { xs: 3, md: 4 } }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="overlineMuted" sx={{ textAlign: "center" }}>
            Works where the jobs are ·{" "}
            <Box component="span" sx={{ color: "accent.primary" }}>
              {BOARDS.length} boards built in
            </Box>{" "}
            · any board you add
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: { xs: 0.75, md: 1 },
            }}
          >
            {BOARDS.map((board) => (
              <Typography
                key={board}
                component="span"
                sx={[
                  chipSx,
                  {
                    color: "text.secondary",
                    border: `1px solid ${line.border}`,
                    backgroundColor: "surfaces.elevated",
                  },
                ]}
              >
                {board}
              </Typography>
            ))}
            <Typography
              component="span"
              sx={[
                chipSx,
                {
                  color: "accent.primary",
                  border: `1px dashed ${accent.primary}66`,
                },
              ]}
            >
              + your board
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
