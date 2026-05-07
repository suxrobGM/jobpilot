"use client";

import type { ReactElement } from "react";
import { Chip, type ChipProps } from "@mui/material";

export const STAGES = [
  "applied",
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "HM screen",
  technical_interview: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STAGE_COLOR: Record<Stage, ChipProps["color"]> = {
  applied: "default",
  recruiter_screen: "info",
  assessment: "info",
  hiring_manager_screen: "primary",
  technical_interview: "primary",
  onsite: "primary",
  offer: "success",
  rejected: "error",
  withdrawn: "default",
};

interface StageChipProps {
  stage: Stage;
  size?: ChipProps["size"];
}

export function StageChip(props: StageChipProps): ReactElement {
  const { stage, size = "small" } = props;
  return (
    <Chip size={size} label={STAGE_LABEL[stage]} color={STAGE_COLOR[stage]} variant="outlined" />
  );
}
