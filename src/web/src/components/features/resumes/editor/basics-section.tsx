"use client";

import type { ReactElement } from "react";
import { TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { ResumeBasics } from "@/lib/schemas/resume";

interface BasicsSectionProps {
  value: ResumeBasics;
  onChange: (next: ResumeBasics) => void;
}

const FIELDS: { key: keyof ResumeBasics; label: string; placeholder?: string }[] = [
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location", placeholder: "City, ST" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/…" },
  { key: "github", label: "GitHub", placeholder: "github.com/…" },
];

export function BasicsSection(props: BasicsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <Grid container spacing={2}>
      {FIELDS.map((f) => (
        <Grid key={f.key} size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label={f.label}
            placeholder={f.placeholder}
            value={value[f.key] ?? ""}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </Grid>
      ))}
    </Grid>
  );
}
