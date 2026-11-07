import type { ReactElement } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import type { LeaderboardRow } from "@/api/types";
import { AvailabilityBadge } from "@/components/features/portfolio/availability-badge";
import { PortfolioAvatar } from "@/components/features/portfolio/portfolio-avatar";
import { ListCard } from "@/components/ui/data";
import { profileHref } from "@/utils/routes";

interface LeaderboardListProps {
  rows: LeaderboardRow[];
}

/** Ranks 4-N as a plain list; rows 1-3 render in the podium above. */
export function LeaderboardList(props: LeaderboardListProps): ReactElement {
  return (
    <ListCard>
      <Stack
        component="ul"
        spacing={0}
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          "& > li + li": { borderTop: 1, borderColor: "divider" },
        }}
      >
        {props.rows.map((row) => (
          <Box component="li" key={row.username}>
            <ButtonBase
              href={profileHref(row.username)}
              sx={{
                width: "100%",
                textAlign: "left",
                px: { xs: 1.5, sm: 2 },
                "&:hover": { backgroundColor: "surfaces.hover" },
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", py: 1.5, width: "100%" }}
              >
                <Typography variant="statLabel" sx={{ width: 36, textAlign: "right" }}>
                  #{row.rank}
                </Typography>
                <PortfolioAvatar name={row.displayName} size={36} availability={row.availability} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="body1Strong">{row.displayName}</Typography>
                    <AvailabilityBadge availability={row.availability} />
                  </Stack>
                  {row.headline && (
                    <Typography variant="captionMuted" sx={{ overflowWrap: "anywhere" }}>
                      {row.headline}
                    </Typography>
                  )}
                </Box>
                <Stack spacing={0.25} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
                  <Typography variant="body2Strong">{row.activityCount}</Typography>
                  <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
                    {row.applications} applied · {row.messagesSent} messaged
                  </Typography>
                </Stack>
              </Stack>
            </ButtonBase>
          </Box>
        ))}
      </Stack>
    </ListCard>
  );
}
