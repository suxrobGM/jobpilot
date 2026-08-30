"use client";

import type { ReactElement } from "react";
import type { ResumeCertification } from "@jobpilot/contracts/resume";
import { Stack, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { EntryList } from "./entry-list";

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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Name"
                value={entry.name}
                onChange={(e) => onUpdate({ ...entry, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Issuer"
                value={entry.issuer ?? ""}
                onChange={(e) => onUpdate({ ...entry, issuer: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                label="Issued"
                value={entry.issued ?? ""}
                onChange={(e) => onUpdate({ ...entry, issued: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth
                label="Expires"
                value={entry.expires ?? ""}
                onChange={(e) => onUpdate({ ...entry, expires: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Credential ID"
                value={entry.credentialId ?? ""}
                onChange={(e) => onUpdate({ ...entry, credentialId: e.target.value })}
              />
            </Grid>
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
