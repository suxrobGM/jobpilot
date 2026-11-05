"use client";

import type { ReactElement } from "react";
import type { ResumeExperience } from "@jobpilot/contracts/resume";
import { Stack } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";

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
      newItem={() => ({
        id: `exp_${crypto.randomUUID()}`,
        company: "",
        title: "",
        location: "",
        start: "",
        end: "",
        bullets: [],
      })}
      addLabel="Add role"
      emptyLabel="No experience entries yet. Add roles below."
      renderTitle={(e, i) =>
        e.company || e.title ? `${e.title || "Role"} · ${e.company || "Company"}` : `Role ${i + 1}`
      }
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <EntryTextField entry={entry} field="company" label="Company" onUpdate={onUpdate} />
            <EntryTextField entry={entry} field="title" label="Title" onUpdate={onUpdate} />
            <EntryTextField entry={entry} field="location" label="Location" onUpdate={onUpdate} />
            <EntryTextField
              entry={entry}
              field="start"
              label="Start"
              placeholder="Jan 2022"
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
