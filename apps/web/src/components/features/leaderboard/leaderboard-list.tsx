import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { LeaderboardRow } from "@/api/types";
import { AvailabilityBadge } from "@/components/features/portfolio/availability-badge";
import { PortfolioAvatar } from "@/components/features/portfolio/portfolio-avatar";
import { ListCard, ListRow } from "@/components/ui/data";
import { profileHref } from "@/utils/routes";

interface LeaderboardListProps {
  rows: LeaderboardRow[];
}

/** Ranks 4-N as a plain list; rows 1-3 render in the podium above. */
export function LeaderboardList(props: LeaderboardListProps): ReactElement {
  return (
    <ListCard>
      {props.rows.map((row) => (
        <ListRow
          key={row.username}
          href={profileHref(row.username)}
          lead={
            <PortfolioAvatar name={row.displayName} size={36} availability={row.availability} />
          }
          title={row.displayName}
          tags={<AvailabilityBadge availability={row.availability} />}
          meta={[`#${row.rank}`, row.headline].filter(Boolean).join(" · ")}
          end={
            <Stack spacing={0.25} sx={{ alignItems: "flex-end" }}>
              <Typography variant="body2Strong">{row.activityCount}</Typography>
              <Typography variant="captionMuted" noWrap>
                {`${row.applications} applied · ${row.messagesSent} messaged`}
              </Typography>
            </Stack>
          }
        />
      ))}
    </ListCard>
  );
}
