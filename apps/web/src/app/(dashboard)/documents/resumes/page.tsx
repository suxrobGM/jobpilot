import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import { ResumesList } from "@/components/features/resumes";

export default function DocumentsResumesPage(): ReactElement {
  return (
    <>
      <Typography variant="body2Muted" sx={{ display: "block", mb: 2 }}>
        Upload a PDF to bootstrap a new base resume, or open one to edit its structure.
      </Typography>
      <ResumesList />
    </>
  );
}
