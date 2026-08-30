"use client";

import type { ReactElement } from "react";
import type { ResumeCustomEntry, ResumeCustomSection } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { BulletListEditor } from "./bullet-list-editor";
import { EntryList } from "./entry-list";

interface CustomSectionsSectionProps {
  value: ResumeCustomSection[];
  onChange: (next: ResumeCustomSection[]) => void;
}

/**
 * Whatever the CV carried that the typed sections don't model - grants, invited talks, patents,
 * teaching, service. Extraction files anything it can't place here rather than dropping it.
 */
export function CustomSectionsSection(props: CustomSectionsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeCustomSection>
      value={value}
      onChange={onChange}
      newItem={() => ({ id: `sec_${crypto.randomUUID()}`, title: "", entries: [] })}
      addLabel="Add section"
      emptyLabel="No custom sections yet."
      renderTitle={(s, i) => s.title || `Section ${i + 1}`}
      renderEntry={(section, onUpdate) => (
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Section heading"
            placeholder="Grants, Invited Talks, Teaching, …"
            value={section.title}
            onChange={(e) => onUpdate({ ...section, title: e.target.value })}
          />
          <EntryList<ResumeCustomEntry>
            value={section.entries}
            onChange={(entries) => onUpdate({ ...section, entries })}
            newItem={() => ({
              id: `ent_${crypto.randomUUID()}`,
              heading: "",
              subheading: "",
              meta: "",
              bullets: [],
            })}
            addLabel="Add entry"
            emptyLabel="No entries yet."
            renderTitle={(e, i) => e.heading || `Entry ${i + 1}`}
            renderEntry={(entry, onEntryUpdate) => (
              <Stack spacing={1.5}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Heading"
                      value={entry.heading}
                      onChange={(e) => onEntryUpdate({ ...entry, heading: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Subheading"
                      placeholder="Funder, host, venue"
                      value={entry.subheading ?? ""}
                      onChange={(e) => onEntryUpdate({ ...entry, subheading: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 2 }}>
                    <TextField
                      fullWidth
                      label="Meta"
                      placeholder="Year"
                      value={entry.meta ?? ""}
                      onChange={(e) => onEntryUpdate({ ...entry, meta: e.target.value })}
                    />
                  </Grid>
                </Grid>
                <BulletListEditor
                  label="Details"
                  value={entry.bullets}
                  onChange={(bullets) => onEntryUpdate({ ...entry, bullets })}
                />
              </Stack>
            )}
          />
        </Stack>
      )}
    />
  );
}
