"use client";

import type { ReactElement } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { PulseDot, type PulseDotTone } from "@/components/ui/feedback";

// Each funnel bucket is exactly one status (its `key`); rejected/withdrawn have no bucket.
export const FUNNEL_GROUPS = [
  { key: "applied", label: "Applied", tone: "blue" },
  { key: "screening", label: "Screening", tone: "violet" },
  { key: "interviewing", label: "Interviewing", tone: "peach" },
  { key: "offer", label: "Offer", tone: "green" },
] as const;

export type FunnelKey = (typeof FUNNEL_GROUPS)[number]["key"];

interface FunnelBarProps {
  counts: Record<FunnelKey, number>;
  selected: FunnelKey | null;
  onSelect: (key: FunnelKey | null) => void;
}

export function FunnelBar(props: FunnelBarProps): ReactElement {
  const { counts, selected, onSelect } = props;

  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
      {FUNNEL_GROUPS.map((group) => {
        const active = selected === group.key;
        const toggle = (): void => onSelect(active ? null : group.key);
        return (
          <Card key={group.key} variant="interactive" sx={{ flex: 1, minWidth: 120 }}>
            <CardContent aria-pressed={active} onClick={toggle}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <PulseDot tone={group.tone as PulseDotTone} />
                <Typography variant="captionMuted">{group.label}</Typography>
              </Stack>
              <Typography variant="h4" sx={{ mt: 0.5 }}>
                {counts[group.key]}
              </Typography>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
