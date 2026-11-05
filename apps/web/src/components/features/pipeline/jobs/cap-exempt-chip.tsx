import type { ReactNode } from "react";
import { Chip, Tooltip } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";

const BASIS_LABELS: Record<NonNullable<PipelineJobDto["capExemptBasis"]>, string> = {
  university: "University employer",
  university_affiliate: "University-affiliated employer",
  nonprofit_research: "Nonprofit research employer",
  government_research: "Government research employer",
};

interface CapExemptChipProps {
  job: PipelineJobDto;
}

/** H-1B cap-exempt employer, linking to the page that shows it. */
export function CapExemptChip(props: CapExemptChipProps): ReactNode {
  const { job } = props;
  if (!job.capExemptBasis) {
    return null;
  }
  const evidence = job.capExemptEvidenceUrl;
  return (
    <Tooltip title={BASIS_LABELS[job.capExemptBasis]}>
      <Chip
        variant="outlined"
        color="success"
        label="Cap-exempt"
        {...(evidence && {
          component: "a",
          href: evidence,
          target: "_blank",
          rel: "noopener noreferrer",
          clickable: true,
        })}
      />
    </Tooltip>
  );
}
