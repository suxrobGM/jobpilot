import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import { CoverLettersTable } from "@/components/features/cover-letters";

export default function DocumentsCoverLettersPage(): ReactElement {
  return (
    <>
      <Typography variant="body2Muted" sx={{ display: "block", mb: 2 }}>
        Cover letters generated during applications. Click a row to review the full text, download a
        PDF, or delete it.
      </Typography>
      <CoverLettersTable />
    </>
  );
}
