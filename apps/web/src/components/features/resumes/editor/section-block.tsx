"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import type { EditorSection } from "./sections";

interface SectionBlockProps {
  section: EditorSection;
  /** What is already in the section, shown while it is collapsed. */
  summary: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}

/** `data-section-id` sits on the outer box so the rail can still scroll to a collapsed section. */
export function SectionBlock(props: SectionBlockProps): ReactElement {
  const { section, summary, open, onToggle, children } = props;
  const Icon = section.icon;

  return (
    <Box data-section-id={section.id}>
      {/* Unmounted while collapsed: otherwise every section re-renders on each keystroke in one. */}
      <Accordion
        expanded={open}
        onChange={(_, next) => onToggle(next)}
        slotProps={{ transition: { unmountOnExit: true } }}
      >
        <AccordionSummary>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
            <Icon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="body1Strong">{section.label}</Typography>
            <Typography variant="captionMuted" sx={{ ml: "auto", pr: 1 }}>
              {summary}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Typography variant="captionMuted">{section.description}</Typography>
            {children}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
