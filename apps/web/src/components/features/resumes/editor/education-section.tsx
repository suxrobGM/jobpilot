"use client";

import type { ReactElement } from "react";
import type { ResumeEducation } from "@jobpilot/contracts/resume";
import { Stack } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";

interface EducationSectionProps {
  value: ResumeEducation[];
  onChange: (next: ResumeEducation[]) => void;
}

export function EducationSection(props: EducationSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeEducation>
      value={value}
      onChange={onChange}
      newItem={() => ({
        id: `edu_${crypto.randomUUID()}`,
        school: "",
        degree: "",
        start: "",
        end: "",
        details: [],
      })}
      addLabel="Add education"
      emptyLabel="No education entries yet."
      renderTitle={(e, i) => e.school || `Entry ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <EntryTextField entry={entry} field="school" label="School" onUpdate={onUpdate} />
            <EntryTextField entry={entry} field="degree" label="Degree" onUpdate={onUpdate} />
            <EntryTextField
              entry={entry}
              field="start"
              label="Start"
              width={3}
              onUpdate={onUpdate}
            />
            <EntryTextField entry={entry} field="end" label="End" width={3} onUpdate={onUpdate} />
          </Grid>
          <BulletListEditor
            label="Details"
            placeholder="GPA, honors, coursework, …"
            value={entry.details}
            onChange={(details) => onUpdate({ ...entry, details })}
          />
        </Stack>
      )}
    />
  );
}
