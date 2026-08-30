"use client";

import type { ReactElement } from "react";
import type { ResumePublication } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";

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
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label="Title"
            value={entry.title}
            onChange={(e) => onUpdate({ ...entry, title: e.target.value })}
          />
          <TextField
            fullWidth
            label="Authors"
            placeholder="Doe J., Smith A., et al."
            helperText="As the citation lists them, so the author order survives."
            value={entry.authors ?? ""}
            onChange={(e) => onUpdate({ ...entry, authors: e.target.value })}
          />
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Venue"
                placeholder="Journal, conference, or publisher"
                value={entry.venue ?? ""}
                onChange={(e) => onUpdate({ ...entry, venue: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Year"
                placeholder="2024, In press, …"
                value={entry.year ?? ""}
                onChange={(e) => onUpdate({ ...entry, year: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="DOI"
                placeholder="10.1000/example"
                value={entry.doi ?? ""}
                onChange={(e) => onUpdate({ ...entry, doi: e.target.value })}
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
          </Grid>
        </Stack>
      )}
    />
  );
}
