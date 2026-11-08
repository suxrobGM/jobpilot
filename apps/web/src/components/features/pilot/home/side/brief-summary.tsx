"use client";

import type { ReactElement } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import { plural } from "@/utils/format";
import { hasGoals } from "../../pilot-status";
import { usePilotState } from "../../use-pilot-state";
import { SideSection } from "./side-section";

interface Rule {
  label: string;
  title: string;
}

/** The goals the pilot works toward and the rules it keeps, read together; Edit changes both. */
export function BriefSummary(): ReactElement {
  const state = usePilotState();
  const goalsSet = hasGoals(state);
  const { dailyApplyCap, minScore, dealBreakers } = state.config;
  const rules: Rule[] = [
    { label: `${dailyApplyCap} a day`, title: "Applications per day" },
    { label: `score ${minScore}+`, title: "Lowest match score worth applying to" },
  ];
  if (dealBreakers.length > 0) {
    const label = plural(dealBreakers.length, "deal-breaker");
    rules.push({ label, title: `Skips: ${dealBreakers.join(", ")}` });
  }

  return (
    <SideSection title="Brief" link={{ label: "Edit", href: "/pilot/goals" }}>
      {goalsSet && (
        <Typography
          variant="body2"
          title={state.goals}
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-line",
          }}
        >
          {state.goals}
        </Typography>
      )}
      {!goalsSet && (
        <Typography variant="body2Muted">
          No goals yet. The pilot builds its searches from them.
        </Typography>
      )}
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {rules.map((rule) => (
          <Chip
            key={rule.label}
            label={rule.label}
            title={rule.title}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
    </SideSection>
  );
}
