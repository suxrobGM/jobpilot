"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactElement } from "react";
import { CloudUpload } from "@mui/icons-material";
import { Box, Button, Stack, Typography, type ButtonProps } from "@mui/material";

export type FileUploadVariant = "button" | "dropzone";

interface FileUploadProps {
  variant?: FileUploadVariant;
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  description?: string;
  selectedFile?: File | null;
  buttonProps?: ButtonProps;
  onFile: (file: File) => void;
  onError?: (message: string) => void;
}

export function FileUpload(props: FileUploadProps): ReactElement {
  const {
    variant = "button",
    accept = "application/pdf",
    maxBytes,
    disabled,
    loading,
    label,
    description,
    selectedFile,
    buttonProps,
    onFile,
    onError,
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File): void => {
    if (maxBytes && file.size > maxBytes) {
      const limit = `${(maxBytes / (1024 * 1024)).toFixed(0)} MB`;
      onError?.(`File must be ${limit} or smaller`);
      return;
    }
    if (accept && !matchesAccept(file, accept)) {
      onError?.(`File type not allowed (expected ${accept})`);
      return;
    }
    onFile(file);
  };

  const openPicker = (): void => {
    if (disabled || loading) {
      return;
    }
    inputRef.current?.click();
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = "";
  };

  const stop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>): void => {
    stop(e);
    if (!disabled && !loading) {
      setDragOver(true);
    }
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    stop(e);
    setDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    stop(e);
    setDragOver(false);
    if (disabled || loading) {
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  if (variant === "button") {
    return (
      <>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CloudUpload />}
          onClick={openPicker}
          disabled={disabled || loading}
          {...buttonProps}
        >
          {loading ? "Uploading…" : (label ?? "Upload file")}
        </Button>
        <input ref={inputRef} type="file" accept={accept} hidden onChange={onInputChange} />
      </>
    );
  }

  return (
    <Stack spacing={1}>
      {label && <Typography variant="body2Muted">{label}</Typography>}
      <Box
        onClick={openPicker}
        onDragOver={onDragEnter}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={(t) => ({
          border: `1px dashed ${dragOver ? t.palette.accent.primary : t.palette.line.border}`,
          bgcolor: dragOver ? t.palette.action.hover : "transparent",
          borderRadius: t.radii.md,
          p: 2.5,
          textAlign: "center",
          cursor: disabled || loading ? "default" : "pointer",
          transition: "border-color 120ms, background-color 120ms",
          "&:hover": disabled || loading ? undefined : { borderColor: t.palette.accent.primary },
        })}
      >
        <CloudUpload fontSize="xxl" />
        <Typography variant="body2" sx={{ mt: 1 }}>
          {loading
            ? "Uploading…"
            : selectedFile
              ? selectedFile.name
              : (description ?? "Click or drop a file here")}
        </Typography>
        {selectedFile && !loading && (
          <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
            {(selectedFile.size / 1024).toFixed(0)} KB
          </Typography>
        )}
      </Box>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={onInputChange} />
    </Stack>
  );
}

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    if (token.endsWith("/*")) {
      return type.startsWith(token.slice(0, -1));
    }
    return type === token;
  });
}
