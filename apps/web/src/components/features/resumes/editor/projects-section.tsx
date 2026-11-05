"use client";

import type { ReactElement } from "react";
import type { ResumeProject } from "@jobpilot/contracts/resume";
import { Stack } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";
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
            <EntryTextField entry={entry} field="name" label="Name" onUpdate={onUpdate} />
            <EntryTextField entry={entry} field="url" label="URL" onUpdate={onUpdate} />
            <EntryTextField
              entry={entry}
              field="start"
              label="Start"
              placeholder="Jan 2024"
              helperText="Enables promoting to experience"
              width={3}
              onUpdate={onUpdate}
            />
            <EntryTextField
              entry={entry}
              field="end"
              label="End"
              placeholder="Present"
              width={3}
              onUpdate={onUpdate}
            />
            <EntryTextField
              entry={entry}
              field="description"
              label="Description"
              onUpdate={onUpdate}
            />
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
