"use client";

import { CloudUpload } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useRef, type ReactElement } from "react";
import type { AnyReactForm } from "./types";

interface FormFileUploadFieldProps {
  form: AnyReactForm;
  name: string;
  label?: string;
  accept?: string;
}

export function FormFileUploadField(props: FormFileUploadFieldProps): ReactElement {
  const { form, name, label, accept = "application/pdf" } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <form.Field name={name}>
      {(field: AnyFieldApi) => {
        const file = field.state.value as File | null | undefined;
        return (
          <Stack spacing={1}>
            {label && <Typography variant="body2Muted">{label}</Typography>}
            <Box
              sx={(t) => ({
                border: `1px dashed ${t.palette.line.border}`,
                borderRadius: t.radii.md,
                p: 2.5,
                textAlign: "center",
                cursor: "pointer",
                "&:hover": { borderColor: t.palette.accent.primary },
              })}
              onClick={() => inputRef.current?.click()}
            >
              <CloudUpload width={28} height={28} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {file ? file.name : "Click to choose a file"}
              </Typography>
              {file && (
                <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
                  {(file.size / 1024).toFixed(0)} KB
                </Typography>
              )}
            </Box>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              hidden
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                field.handleChange(next);
              }}
            />
            {file && (
              <Button
                size="small"
                onClick={() => field.handleChange(null)}
                sx={{ alignSelf: "flex-start" }}
              >
                Remove
              </Button>
            )}
          </Stack>
        );
      }}
    </form.Field>
  );
}
