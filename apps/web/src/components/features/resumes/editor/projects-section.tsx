"use client";

import type { ReactElement } from "react";
import type { ResumeProject } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";
import { TagInput } from "./tag-input";

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
      newItem={() => ({
        id: `proj_${crypto.randomUUID()}`,
        name: "",
        url: "",
        description: "",
        bullets: [],
        keywords: [],
      })}
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
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                label="Start"
                placeholder="Jan 2024"
                helperText="Enables promoting to experience"
                value={entry.start ?? ""}
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Description"
                value={entry.description ?? ""}
                onChange={(e) => onUpdate({ ...entry, description: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TagInput
                label="Keywords"
                placeholder="Type a keyword, press Enter"
                value={entry.keywords}
                onChange={(keywords) => onUpdate({ ...entry, keywords })}
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
