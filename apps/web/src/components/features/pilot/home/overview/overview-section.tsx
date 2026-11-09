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

interface OverviewRowProps {
  label: ReactNode;
  /** Muted text after the label, cut to fit. */
  detail?: string;
  /** What the row is, on hover. */
  hint?: string;
  dimmed?: boolean;
  /** A value or an action, flush right. */
  end?: ReactNode;
}

/** One line of an overview section: label, muted detail, then `end`. */
export function OverviewRow(props: OverviewRowProps): ReactElement {
  const { label, detail, hint, dimmed, end } = props;
  return (
    <Stack direction="row" spacing={1} title={hint} sx={{ alignItems: "center", minHeight: 30 }}>
      <Typography
        variant="body2"
        noWrap
        sx={{
          flex: detail ? "0 0 auto" : 1,
          minWidth: 0,
          color: dimmed ? "text.secondary" : "text.primary",
        }}
      >
        {label}
      </Typography>
      {detail && (
        <Typography variant="body2Muted" noWrap title={detail} sx={{ flex: 1, minWidth: 0 }}>
          {detail}
        </Typography>
      )}
      {end}
    </Stack>
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
        <Typography variant="overlineMuted">{title}</Typography>
        {link && <EdgeLinkButton {...link} />}
      </Stack>
      {children}
    </Stack>
  );
}
