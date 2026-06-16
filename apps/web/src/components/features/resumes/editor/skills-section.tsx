"use client";

import type { ReactElement } from "react";
import type { ResumeSkillGroup } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import { EntryList } from "./entry-list";

interface SkillsSectionProps {
  value: ResumeSkillGroup[];
  onChange: (next: ResumeSkillGroup[]) => void;
}

export function SkillsSection(props: SkillsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeSkillGroup>
      value={value}
      onChange={onChange}
      newItem={() => ({ group: "", items: [] })}
      addLabel="Add skill group"
      emptyLabel="No skill groups yet."
      renderTitle={(g, i) => g.group || `Group ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label="Group name"
            placeholder="e.g. Languages, Frameworks"
            value={entry.group}
            onChange={(e) => onUpdate({ ...entry, group: e.target.value })}
          />
          <TextField
            fullWidth
            label="Items (comma-separated)"
            value={entry.items.join(", ")}
            onChange={(e) =>
              onUpdate({
                ...entry,
                items: e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
          />
        </Stack>
      )}
    />
  );
}
