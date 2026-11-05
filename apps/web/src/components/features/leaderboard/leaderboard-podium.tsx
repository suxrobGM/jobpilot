import type { ReactElement } from "react";
import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import type { LeaderboardRow } from "@/api/types";
import { AvailabilityBadge } from "@/components/features/portfolio/availability-badge";
import { PortfolioAvatar } from "@/components/features/portfolio/portfolio-avatar";

interface LeaderboardPodiumProps {
  rows: LeaderboardRow[];
}

/** Gold/silver/bronze via theme feedback tokens - no raw hex. */
const MEDAL = ["warning.main", "text.secondary", "accent.dark"] as const;

/** Top-3 highlight. Renders however many of the first three exist (0-3). */
export function LeaderboardPodium(props: LeaderboardPodiumProps): ReactElement {
  const top = props.rows.slice(0, 3);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "stretch" }}>
      {top.map((row) => {
        const medal = MEDAL[row.rank - 1] ?? "text.primary";
        return (
          <Card
            key={row.username}
            variant="accent"
            sx={{ flex: 1, alignSelf: { sm: row.rank === 1 ? "stretch" : "flex-end" } }}
          >
            <CardActionArea href={`/u/${row.username}` as Route} sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
                  <Typography variant="statValue" sx={{ color: medal }}>
                    #{row.rank}
                  </Typography>
                  <PortfolioAvatar
                    name={row.displayName}
                    size={56}
                    availability={row.availability}
                  />
                  <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                    <Typography variant="body1Strong">{row.displayName}</Typography>
                    {row.headline && (
                      <Typography variant="captionMuted" sx={{ overflowWrap: "anywhere" }}>
                        {row.headline}
                      </Typography>
                    )}
                    <AvailabilityBadge availability={row.availability} />
                  </Stack>
                  <Stack spacing={0.25} sx={{ alignItems: "center" }}>
                    <Typography variant="statValue">{row.activityCount}</Typography>
                    <Typography variant="captionMuted">
                      {row.applications} applied · {row.messagesSent} messaged
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}
