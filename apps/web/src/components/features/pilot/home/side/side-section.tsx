import type { ReactElement, ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import { EdgeLinkButton, type EdgeLinkButtonProps } from "./edge-link-button";

interface SideSectionProps {
  title: string;
  link?: EdgeLinkButtonProps;
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
        {link && <EdgeLinkButton {...link} />}
      </Stack>
      {children}
    </Stack>
  );
}
