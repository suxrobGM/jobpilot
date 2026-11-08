import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { LinkButton } from "@/components/ui/buttons";

interface EdgeLinkButtonProps {
  label: string;
  href: Route;
}

/** A text link whose label ends flush with the panel edge, like the numbers above it. */
export function EdgeLinkButton(props: EdgeLinkButtonProps): ReactElement {
  const { label, href } = props;
  return (
    <LinkButton size="small" href={href} sx={{ minWidth: 0, px: 1, mr: -1, flexShrink: 0 }}>
      {label}
    </LinkButton>
  );
}

interface OverviewSectionProps {
  title: string;
  link?: EdgeLinkButtonProps;
  children: ReactNode;
}

export function OverviewSection(props: OverviewSectionProps): ReactElement {
  const { title, link, children } = props;
  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", minHeight: 30 }}
      >
        <Typography variant="overline" color="textSecondary">
          {title}
        </Typography>
        {link && <EdgeLinkButton {...link} />}
      </Stack>
      {children}
    </Stack>
  );
}
