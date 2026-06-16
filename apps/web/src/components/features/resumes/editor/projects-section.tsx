"use client";

import type { ReactElement } from "react";
import type { ResumeProject } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";

interface ProjectsSectionProps {
  value: ResumeProject[];
  onChange: (next: ResumeProject[]) => void;
}

export function ProjectsSection(props: ProjectsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeProject>
      value={value}
      onChange={onChange}
      newItem={() => ({ name: "", url: "", description: "", bullets: [], keywords: [] })}
      addLabel="Add project"
      emptyLabel="No projects yet."
      renderTitle={(p, i) => p.name || `Project ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Name"
                value={entry.name}
                onChange={(e) => onUpdate({ ...entry, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="URL"
                value={entry.url ?? ""}
                onChange={(e) => onUpdate({ ...entry, url: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                value={entry.description ?? ""}
                onChange={(e) => onUpdate({ ...entry, description: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Keywords (comma-separated)"
                value={entry.keywords.join(", ")}
                onChange={(e) =>
                  onUpdate({
                    ...entry,
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Grid>
          </Grid>
          <BulletListEditor
            label="Bullets"
            placeholder="What you built / shipped / learned"
            value={entry.bullets}
            onChange={(bullets) => onUpdate({ ...entry, bullets })}
          />
        </Stack>
      )}
    />
  );
}
