"use client";

import type { ReactElement, ReactNode } from "react";
import { ArrowBack } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { createPortal } from "react-dom";
import { TooltipIconButton } from "@/components/ui/buttons";
import { useTopBarSlots } from "./top-bar-slots";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Page tabs, set flush under the title in the top bar. */
  tabs?: ReactNode;
  /** When set, renders a back button before the title. */
  backHref?: Route;
  backLabel?: string;
}

/** Title, back button, actions and tabs go to the top bar; the description stays on the page. */
export function PageHeader(props: PageHeaderProps): ReactElement {
  const { eyebrow, title, description, actions, tabs, backHref, backLabel = "Back" } = props;
  const slots = useTopBarSlots();

  const heading = (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
      {backHref && (
        <TooltipIconButton title={backLabel} href={backHref} size="small" edge="start">
          <ArrowBack fontSize="md" />
        </TooltipIconButton>
      )}
      <Stack sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="captionMuted" noWrap>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h3" component="h1" noWrap>
          {title}
        </Typography>
      </Stack>
    </Stack>
  );

  return (
    <>
      {slots.title && createPortal(heading, slots.title)}
      {slots.actions && actions && createPortal(actions, slots.actions)}
      {slots.tabs && tabs && createPortal(tabs, slots.tabs)}
      {description && (
        <Box sx={{ mb: 1 }}>
          {typeof description === "string" ? (
            <Typography variant="body1Muted">{description}</Typography>
          ) : (
            description
          )}
        </Box>
      )}
    </>
  );
}
