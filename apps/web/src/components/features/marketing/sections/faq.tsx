"use client";

import type { ReactElement } from "react";
import { ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { Section } from "../section";
import { FAQ_ITEMS } from "./faq-items";

export function Faq(): ReactElement {
  return (
    <Section maxWidth="md">
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h2">Questions, answered.</Typography>
        <Typography variant="body2Muted">
          More in the <Link href="/docs/faq">full FAQ</Link>.
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {FAQ_ITEMS.map((item) => (
          <Accordion
            key={item.q}
            disableGutters
            elevation={0}
            sx={(theme) => ({
              border: `1px solid ${theme.palette.line.border}`,
              borderRadius: `${theme.radii.md}px`,
              backgroundColor: theme.palette.surfaces.card,
              transition: theme.motion.fast,
              "&:hover": { borderColor: theme.palette.line.borderHi },
              "&::before": { display: "none" },
            })}
          >
            <AccordionSummary expandIcon={<ExpandMore fontSize="sm" />}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.q}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2Muted">{item.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Section>
  );
}
