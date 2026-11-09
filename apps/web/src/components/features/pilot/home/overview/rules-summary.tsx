"use client";

import type { ReactElement } from "react";
import { Chip, Stack } from "@mui/material";
import { plural } from "@/utils/format";
import { usePilotState } from "../../state/use-pilot-state";
import { OverviewSection } from "./overview-section";

interface Rule {
  label: string;
  title: string;
}

/** The limits the pilot keeps, as chips. */
export function RulesSummary(): ReactElement {
  const { dailyApplyCap, minScore, dealBreakers, preferCapExempt } = usePilotState().config;
  const rules: Rule[] = [
    { label: `${dailyApplyCap} a day`, title: "Applications per day" },
    { label: `score ${minScore}+`, title: "Lowest match score worth applying to" },
  ];
  if (dealBreakers.length > 0) {
    const label = plural(dealBreakers.length, "deal-breaker");
    rules.push({ label, title: `Skips: ${dealBreakers.join(", ")}` });
  }
  if (preferCapExempt) {
    rules.push({ label: "cap-exempt first", title: "Ranks H-1B cap-exempt employers higher" });
  }

  return (
    <OverviewSection title="Rules" link={{ label: "Edit", href: "/pilot/searches" }}>
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
    </OverviewSection>
  );
}
