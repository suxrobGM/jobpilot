"use client";

import type { ReactElement } from "react";
import type { ResumeAward } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";

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
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Title"
                value={entry.title}
                onChange={(e) => onUpdate({ ...entry, title: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Issuer"
                value={entry.issuer ?? ""}
                onChange={(e) => onUpdate({ ...entry, issuer: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                fullWidth
                label="Year"
                value={entry.year ?? ""}
                onChange={(e) => onUpdate({ ...entry, year: e.target.value })}
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Description"
            value={entry.description ?? ""}
            onChange={(e) => onUpdate({ ...entry, description: e.target.value })}
          />
        </Stack>
      )}
    />
  );
}
