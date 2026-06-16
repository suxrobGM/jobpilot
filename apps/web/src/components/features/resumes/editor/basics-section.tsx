"use client";

import type { ReactElement } from "react";
import type { ResumeBasics } from "@jobpilot/contracts/resume";
import { TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { PhoneField } from "@/components/ui/form";

interface BasicsSectionProps {
  value: ResumeBasics;
  onChange: (next: ResumeBasics) => void;
}

const TEXT_FIELDS: {
  key: Exclude<keyof ResumeBasics, "phone">;
  label: string;
  placeholder?: string;
}[] = [
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "location", label: "Location", placeholder: "City, ST" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/…" },
  { key: "github", label: "GitHub", placeholder: "github.com/…" },
];

export function BasicsSection(props: BasicsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Headline"
          placeholder="Senior Software Developer"
          value={value.headline ?? ""}
          onChange={(e) => onChange({ ...value, headline: e.target.value })}
        />
      </Grid>
      {TEXT_FIELDS.map((f) => (
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
      <Grid size={{ xs: 12, sm: 6 }}>
        <PhoneField
          label="Phone"
          value={value.phone ?? ""}
          onChange={(next) => onChange({ ...value, phone: next })}
        />
      </Grid>
    </Grid>
  );
}
