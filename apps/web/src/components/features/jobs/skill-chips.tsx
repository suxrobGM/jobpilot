import type { ReactNode } from "react";
import { serializeSkillsParam } from "@jobpilot/contracts/job-listing";
import { Box, Link, Typography } from "@mui/material";
import { motion } from "@/theme";
import { jobsHref } from "./jobs-href";

// The raw token, not an `sx` callback: a function can't cross the RSC boundary into MUI's Link.
const linkedChipSx = {
  // MuiLink's theme default paints links in the accent; a tag only takes it on hover.
  color: "text.secondary",
  transition: motion.fast,
  "&:hover": { color: "accent.primary", borderColor: "accent.primary" },
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
            variant="skillChip"
            underline="none"
            href={jobsHref(new URLSearchParams({ skills: serializeSkillsParam([item]) }))}
            sx={linkedChipSx}
          >
            {item}
          </Link>
        ) : (
          <Typography key={item} variant="skillChip">
            {item}
          </Typography>
        ),
      )}
      {overflow > 0 && <Typography variant="skillChip">+{overflow}</Typography>}
    </Box>
  );
}
