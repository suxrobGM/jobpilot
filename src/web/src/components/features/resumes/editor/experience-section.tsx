"use client";

import type { ReactElement } from "react";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { ResumeExperience } from "@jobpilot/contracts/resume";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";

interface ExperienceSectionProps {
  value: ResumeExperience[];
  onChange: (next: ResumeExperience[]) => void;
}

export function ExperienceSection(props: ExperienceSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeExperience>
      value={value}
      onChange={onChange}
      newItem={() => ({ company: "", title: "", location: "", start: "", end: "", bullets: [] })}
      addLabel="Add role"
      emptyLabel="No experience entries yet. Add roles below."
      renderTitle={(e, i) =>
        e.company || e.title ? `${e.title || "Role"} · ${e.company || "Company"}` : `Role ${i + 1}`
      }
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Company"
                value={entry.company}
                onChange={(e) => onUpdate({ ...entry, company: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Title"
                value={entry.title}
                onChange={(e) => onUpdate({ ...entry, title: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Location"
                value={entry.location ?? ""}
                onChange={(e) => onUpdate({ ...entry, location: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                label="Start"
                placeholder="Jan 2022"
                value={entry.start}
                onChange={(e) => onUpdate({ ...entry, start: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                label="End"
                placeholder="Present"
                value={entry.end ?? ""}
                onChange={(e) => onUpdate({ ...entry, end: e.target.value })}
              />
            </Grid>
          </Grid>
          <BulletListEditor
            label="Achievements"
            placeholder="Led migration of …"
            value={entry.bullets}
            onChange={(bullets) => onUpdate({ ...entry, bullets })}
          />
        </Stack>
      )}
    />
  );
}
