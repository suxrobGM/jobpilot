"use client";

import type { ReactNode } from "react";
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { ResumeDto } from "@/api/types";

interface ProfileMismatchCardProps {
  mismatches: ResumeDto["profileMismatches"];
}

const FIELD_LABELS: Record<ResumeDto["profileMismatches"][number]["field"], string> = {
  location: "Location",
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
};

/**
 * Recruiters read the resume; forms and cover-letter headers come from the profile. Surface a
 * disagreement rather than silently shipping both versions.
 */
export function ProfileMismatchCard(props: ProfileMismatchCardProps): ReactNode {
  const { mismatches } = props;

  if (mismatches.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      variant="outlined"
      action={
        <Button component={Link} href="/settings/profile" color="inherit" size="small">
          Edit profile
        </Button>
      }
    >
      <AlertTitle>This resume disagrees with your profile</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Application forms and cover-letter headers use the profile values. Fix whichever side is out
        of date.
      </Typography>
      <Stack spacing={0.5}>
        {mismatches.map((mismatch) => (
          <Typography key={mismatch.field} variant="body2">
            <strong>{FIELD_LABELS[mismatch.field]}</strong> - resume says {mismatch.resume}, profile
            says {mismatch.profile}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}
