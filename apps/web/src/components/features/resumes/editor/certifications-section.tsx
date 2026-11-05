"use client";

import type { ReactElement } from "react";
import type { ResumeCertification } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";
import { EntryTextField } from "./entry-text-field";

interface CertificationsSectionProps {
  value: ResumeCertification[];
  onChange: (next: ResumeCertification[]) => void;
}

export function CertificationsSection(props: CertificationsSectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <EntryList<ResumeCertification>
      value={value}
      onChange={onChange}
      newItem={() => ({
        id: `cert_${crypto.randomUUID()}`,
        name: "",
        issuer: "",
        issued: "",
        expires: "",
        credentialId: "",
        url: "",
      })}
      addLabel="Add certification"
      emptyLabel="No certifications yet."
      renderTitle={(e, i) => e.name || `Certification ${i + 1}`}
      renderEntry={(entry, onUpdate) => (
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <EntryTextField entry={entry} field="name" label="Name" onUpdate={onUpdate} />
            <EntryTextField entry={entry} field="issuer" label="Issuer" onUpdate={onUpdate} />
            <EntryTextField
              entry={entry}
              field="issued"
              label="Issued"
              width={3}
              onUpdate={onUpdate}
            />
            <EntryTextField
              entry={entry}
              field="expires"
              label="Expires"
              width={3}
              onUpdate={onUpdate}
            />
            <EntryTextField
              entry={entry}
              field="credentialId"
              label="Credential ID"
              onUpdate={onUpdate}
            />
          </Grid>
          <TextField
            fullWidth
            label="URL"
            value={entry.url ?? ""}
            onChange={(e) => onUpdate({ ...entry, url: e.target.value })}
          />
        </Stack>
      )}
    />
  );
}
