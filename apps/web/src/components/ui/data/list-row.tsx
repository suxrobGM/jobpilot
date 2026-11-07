"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, Checkbox, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import NextLink from "next/link";

// The title's ::after covers the row so the whole row opens it; other controls sit above it.
const OPEN_ATTR = "data-row-open";

const titleSx = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "inherit",
  textDecoration: "none",
  "&:focus-visible": { outline: "none" },
  "&::after": { content: '""', position: "absolute", inset: 0 },
} as const;

interface RowSelection {
  selected: boolean;
  onToggle: () => void;
  /** Names the record for the checkbox's screen-reader label. */
  label: string;
}

interface RowTitleProps {
  href?: Route;
  onOpen?: () => void;
  title: ReactNode;
}

function RowTitle(props: RowTitleProps): ReactElement {
  const { href, onOpen, title } = props;
  const open = { [OPEN_ATTR]: "" };
  if (href) {
    return (
      <Typography component={NextLink} href={href} variant="body2Strong" sx={titleSx} {...open}>
        {title}
      </Typography>
    );
  }
  if (onOpen) {
    return (
      <Typography
        component="button"
        type="button"
        onClick={onOpen}
        variant="body2Strong"
        sx={{ ...titleSx, p: 0, border: 0, background: "none", textAlign: "left" }}
        {...open}
      >
        {title}
      </Typography>
    );
  }
  return (
    <Typography variant="body2Strong" noWrap>
      {title}
    </Typography>
  );
}

interface ListRowProps extends RowTitleProps {
  /** Null for a list without bulk actions. */
  selection?: RowSelection | null;
  /** A 36px square: `ListLead`, or a score badge. */
  lead?: ReactNode;
  /** Chips beside the title. */
  tags?: ReactNode;
  /** The one muted line of details under the title. */
  meta?: ReactNode;
  /** A third line, for something the row must flag (a failure reason). */
  note?: ReactNode;
  /** `ListCell`s, shown from md up only. */
  columns?: ReactNode;
  /** Hidden until hover where there is one; always shown on touch screens. */
  actions?: ReactNode;
  status?: ReactNode;
  time?: ReactNode;
  /** A trailing ⋯ menu. */
  menu?: ReactNode;
  dimmed?: boolean;
}

/** One record in a `ListCard`; on phones it wraps to title, details, then status and time. */
export function ListRow(props: ListRowProps): ReactElement {
  const { href, onOpen, title, selection, lead, tags, meta, note, columns } = props;
  const { actions, status, time, menu, dimmed } = props;
  const opens = Boolean(href || onOpen);

  return (
    <Stack
      direction="row"
      sx={(theme) => ({
        position: "relative",
        alignItems: "center",
        flexWrap: { xs: "wrap", sm: "nowrap" },
        columnGap: 1.5,
        rowGap: 1,
        minHeight: 60,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        borderBottom: 1,
        borderColor: "divider",
        transition: theme.motion.fast,
        "&:last-of-type": { borderBottom: 0 },
        // An accent edge, not a tint: orange over the dark card reads brown.
        ...(selection?.selected && {
          boxShadow: `inset 2px 0 0 ${theme.palette.accent.primary}`,
        }),
        ...(opens && {
          cursor: "pointer",
          "&:hover": { backgroundColor: theme.palette.surfaces.elevated },
          [`&:has([${OPEN_ATTR}]:focus-visible)`]: {
            boxShadow: `inset ${theme.shadows_custom.focus}`,
          },
        }),
        [`& a:not([${OPEN_ATTR}]), & .MuiButtonBase-root, & .MuiChip-root`]: {
          position: "relative",
          zIndex: 1,
        },
        "@media (hover: hover)": {
          "& .row-actions": { opacity: 0 },
          "&:hover .row-actions, &:focus-within .row-actions": { opacity: 1 },
        },
      })}
    >
      {selection && (
        <Checkbox
          size="small"
          checked={selection.selected}
          onChange={selection.onToggle}
          slotProps={{ input: { "aria-label": `Select ${selection.label}` } }}
          sx={{ p: 0, display: { xs: "none", sm: "inline-flex" } }}
        />
      )}
      {lead && <Box sx={{ flexShrink: 0, display: "flex" }}>{lead}</Box>}
      <Stack
        spacing={0.25}
        sx={{
          flex: 1,
          minWidth: 0,
          flexBasis: { xs: lead ? "calc(100% - 48px)" : "100%", sm: 0 },
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <RowTitle href={href} onOpen={onOpen} title={title} />
          {tags}
        </Stack>
        {meta && (
          <Typography variant="body2Muted" noWrap component="div">
            {meta}
          </Typography>
        )}
        {note}
      </Stack>
      {/* Phones: the items below wrap to a second line, indented under the title. */}
      {lead && <Box sx={{ display: { xs: "block", sm: "none" }, width: 36, flexShrink: 0 }} />}
      {/* Before the columns, so rows with fewer actions don't shift the columns out of line. */}
      {actions && (
        <Stack
          direction="row"
          spacing={0.5}
          className="row-actions"
          sx={(theme) => ({ alignItems: "center", flexShrink: 0, transition: theme.motion.fast })}
        >
          {actions}
        </Stack>
      )}
      {columns && (
        <Stack direction="row" spacing={2} sx={{ display: { xs: "none", md: "flex" } }}>
          {columns}
        </Stack>
      )}
      {status && <Box sx={{ display: "flex", flexShrink: 0, minWidth: { sm: 104 } }}>{status}</Box>}
      {time && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexShrink: 0,
            ml: { xs: "auto", sm: 0 },
            minWidth: { sm: 64 },
          }}
        >
          {time}
        </Box>
      )}
      {menu}
    </Stack>
  );
}

interface ListCellProps {
  width: number;
  children: ReactNode;
}

/** A fixed-width column in a row's `columns`, so cells line up down the list. */
export function ListCell(props: ListCellProps): ReactElement {
  const { width, children } = props;
  return (
    <Typography variant="body2Muted" noWrap component="div" sx={{ width }}>
      {children}
    </Typography>
  );
}

interface ListLeadProps {
  children: ReactNode;
}

/** The row's leading square: initials or an icon. */
export function ListLead(props: ListLeadProps): ReactElement {
  const { children } = props;
  return (
    <Box
      sx={(theme) => ({
        width: 36,
        height: 36,
        display: "grid",
        placeItems: "center",
        borderRadius: theme.radii.md,
        backgroundColor: theme.palette.surfaces.elevated,
        color: "text.secondary",
        typography: "body2Strong",
      })}
    >
      {children}
    </Box>
  );
}
