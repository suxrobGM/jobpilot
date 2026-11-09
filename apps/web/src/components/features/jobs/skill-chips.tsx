import type { ReactNode } from "react";
import { serializeSkillsParam } from "@jobpilot/contracts/job-listing";
import { Box, Chip, Link } from "@mui/material";
import { jobsHref } from "./jobs-href";

// A plain object, not an `sx` callback: a function can't cross the RSC boundary into MUI.
const linkedChipSx = {
  "&:hover .MuiChip-root": { color: "accent.primary", borderColor: "accent.primary" },
} as const;

interface SkillChipsProps {
  skills: readonly string[];
  /** Omit to show every skill. */
  max?: number;
  /** Links each chip to `/jobs?skills=…`. Never inside a JobCard or JobRow: anchors can't nest. */
  linked?: boolean;
}

export function SkillChips(props: SkillChipsProps): ReactNode {
  const { skills, max, linked = false } = props;
  if (skills.length === 0) {
    return null;
  }

  const shown = max ? skills.slice(0, max) : skills;
  const overflow = skills.length - shown.length;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {shown.map((item) =>
        linked ? (
          <Link
            key={item}
            underline="none"
            href={jobsHref(new URLSearchParams({ skills: serializeSkillsParam([item]) }))}
            sx={linkedChipSx}
          >
            <Chip variant="tag" label={item} />
          </Link>
        ) : (
          <Chip key={item} variant="tag" label={item} />
        ),
      )}
      {overflow > 0 && <Chip variant="tag" label={`+${overflow}`} />}
    </Box>
  );
}
