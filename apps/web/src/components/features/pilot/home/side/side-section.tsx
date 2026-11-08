import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { EdgeLinkButton } from "./edge-link-button";

interface SideSectionLink {
  label: string;
  href: Route;
}

interface SideSectionProps {
  title: string;
  link?: SideSectionLink;
  children: ReactNode;
}

export function SideSection(props: SideSectionProps): ReactElement {
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
        {link && <EdgeLinkButton label={link.label} href={link.href} />}
      </Stack>
      {children}
    </Stack>
  );
}
