"use client";

import type { ReactElement } from "react";
import type { ResumeAward } from "@jobpilot/contracts/resume";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";

interface AwardsSectionProps {
  value: ResumeAward[];
  onChange: (next: ResumeAward[]) => void;
}

export function AwardsSection(props: AwardsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeAward>
      value={value}
      onChange={onChange}
      newItem={() => ({
        id: `awd_${crypto.randomUUID()}`,
        title: "",
        issuer: "",
        year: "",
        description: "",
      })}
      addLabel="Add award"
      emptyLabel="No awards yet."
      renderTitle={(e, i) => e.title || `Award ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Grid container spacing={1.5}>
          <EntryTextField entry={entry} field="title" label="Title" onUpdate={onUpdate} />
          <EntryTextField
            entry={entry}
            field="issuer"
            label="Issuer"
            width={4}
            onUpdate={onUpdate}
          />
          <EntryTextField entry={entry} field="year" label="Year" width={2} onUpdate={onUpdate} />
          <EntryTextField
            entry={entry}
            field="description"
            label="Description"
            width={12}
            multiline
            minRows={2}
            onUpdate={onUpdate}
          />
        </Grid>
      )}
    />
  );
}
