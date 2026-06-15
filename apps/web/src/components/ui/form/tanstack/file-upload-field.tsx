"use client";

import type { ReactElement } from "react";
import { Button, Stack } from "@mui/material";
import { FileUpload as BaseFileUpload } from "../file-upload";
import { useFieldContext } from "./form-context";

interface FileUploadProps {
  label?: string;
  accept?: string;
  maxBytes?: number;
}

/** TanStack Form-bound file upload — wires a `File | null` field to the base FileUpload dropzone. */
export function FileUpload(props: FileUploadProps): ReactElement {
  const { label, accept, maxBytes } = props;
  const field = useFieldContext<File | null | undefined>();
  const file = field.state.value ?? null;

  return (
    <Stack spacing={1}>
      <BaseFileUpload
        variant="dropzone"
        accept={accept}
        maxBytes={maxBytes}
        label={label}
        selectedFile={file}
        onFile={(f) => field.handleChange(f)}
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
}
