import type { ReactElement } from "react";
import { Box, Divider, Link as MuiLink, Stack, Typography } from "@mui/material";
import type { PortfolioDto } from "@/api/types";
import { ActivityHeatmap } from "./activity-heatmap";
import { PortfolioCard } from "./portfolio-card";
import { PortfolioStatsRow } from "./portfolio-stats";

interface PortfolioViewProps {
  portfolio: PortfolioDto;
  /** Public page shows the marketing footer CTA; the settings preview hides it. */
  showFooter?: boolean;
}

/** The full portfolio, shared verbatim by the public /u/[username] page and the settings preview. */
export function PortfolioView(props: PortfolioViewProps): ReactElement {
  const { portfolio, showFooter = true } = props;

  return (
    <Stack spacing={4}>
      <PortfolioCard portfolio={portfolio} />

      <Stack spacing={2}>
        <Typography variant="h4" component="h3">
          Activity
        </Typography>
        <PortfolioStatsRow stats={portfolio.stats} />
        <ActivityHeatmap perDay={portfolio.perDay} />
      </Stack>

      {showFooter && (
        <>
          <Divider />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2Muted">
              Built with{" "}
              <MuiLink href="/" sx={{ fontWeight: 600 }}>
                JobPilot
              </MuiLink>{" "}
              · see the <MuiLink href="/leaderboard">trending leaderboard</MuiLink>
            </Typography>
          </Box>
        </>
      )}
    </Stack>
  );
}
