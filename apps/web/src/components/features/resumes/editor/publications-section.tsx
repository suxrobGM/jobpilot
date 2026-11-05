"use client";

import type { ReactElement } from "react";
import type { ResumePublication } from "@jobpilot/contracts/resume";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";

interface PublicationsSectionProps {
  value: ResumePublication[];
  onChange: (next: ResumePublication[]) => void;
}

export function PublicationsSection(props: PublicationsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumePublication>
      value={value}
      onChange={onChange}
      newItem={() => ({
        id: `pub_${crypto.randomUUID()}`,
        title: "",
        authors: "",
        venue: "",
        year: "",
        url: "",
        doi: "",
      })}
      addLabel="Add publication"
      emptyLabel="No publications yet."
      renderTitle={(e, i) => e.title || `Publication ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Grid container spacing={1.5}>
          <EntryTextField
            entry={entry}
            field="title"
            label="Title"
            width={12}
            onUpdate={onUpdate}
          />
          <EntryTextField
            entry={entry}
            field="authors"
            label="Authors"
            placeholder="Doe J., Smith A., et al."
            helperText="As the citation lists them, so the author order survives."
            width={12}
            onUpdate={onUpdate}
          />
          <EntryTextField
            entry={entry}
            field="venue"
            label="Venue"
            placeholder="Journal, conference, or publisher"
            width={8}
            onUpdate={onUpdate}
          />
          <EntryTextField
            entry={entry}
            field="year"
            label="Year"
            placeholder="2024, In press, …"
            width={4}
            onUpdate={onUpdate}
          />
          <EntryTextField
            entry={entry}
            field="doi"
            label="DOI"
            placeholder="10.1000/example"
            onUpdate={onUpdate}
          />
          <EntryTextField entry={entry} field="url" label="URL" onUpdate={onUpdate} />
        </Grid>
      )}
    />
  );
}
