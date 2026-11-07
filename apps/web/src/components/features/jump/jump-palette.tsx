"use client";

import { type KeyboardEvent, type ReactElement, useEffect, useState } from "react";
import { Search, SendOutlined, WorkOutlined } from "@mui/icons-material";
import { Box, ButtonBase, Dialog, InputBase, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { applicationQueries, pipelineQueries } from "@/api/queries";
import { ADMIN_NAV_ITEM, SETTINGS_NAV_ITEM } from "@/components/layout/shell-config";
import { useNavGroups } from "@/components/layout/use-nav-groups";
import { useSession } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isAdminRole } from "@/lib/roles";
import { applicationHref } from "@/utils/routes";
import { type JumpTarget, jumpPages, matchesQuery } from "./jump-targets";

/** Records are searched once the query is this long; one letter matches half the account. */
const MIN_SEARCH = 2;
const RESULTS_PER_GROUP = 5;

interface JumpGroup {
  label: string;
  targets: JumpTarget[];
}

/** Pages always; applications and jobs to review once the user has typed enough to search. */
interface JumpResults {
  groups: JumpGroup[];
  /** Records are still on their way for what's typed. */
  searching: boolean;
}

function useJumpGroups(query: string): JumpResults {
  const groups = useNavGroups();
  const { user } = useSession();
  const search = useDebouncedValue(query.trim(), 200);
  const canSearch = search.length >= MIN_SEARCH;
  const page = { page: 1, limit: RESULTS_PER_GROUP, search };

  const applications = useQuery({
    ...applicationQueries.list(page),
    enabled: canSearch,
  });
  const jobs = useQuery({
    ...pipelineQueries.jobs({ ...page, view: "review" }),
    enabled: canSearch,
  });

  const extra = isAdminRole(user?.role) ? [SETTINGS_NAV_ITEM, ADMIN_NAV_ITEM] : [SETTINGS_NAV_ITEM];
  const pages = jumpPages(groups, extra).filter((target) => matchesQuery(target, query.trim()));
  const found: JumpGroup[] = canSearch
    ? [
        {
          label: "Applications",
          targets: (applications.data?.items ?? []).map((app) => ({
            id: `application:${app.id}`,
            label: app.title,
            hint: app.company,
            href: applicationHref(app.id),
            icon: SendOutlined,
          })),
        },
        {
          label: "Jobs to review",
          targets: (jobs.data?.items ?? []).map((job) => ({
            id: `job:${job.id}`,
            label: job.title,
            hint: job.company,
            // Jobs open in the pipeline's drawer, which has no URL; the search narrows to this one.
            href: `/pipeline?view=review&q=${encodeURIComponent(job.title)}` as Route,
            icon: WorkOutlined,
          })),
        },
      ]
    : [];
  const typed = query.trim();
  return {
    groups: [{ label: "Go to", targets: pages }, ...found].filter((g) => g.targets.length > 0),
    searching:
      typed.length >= MIN_SEARCH &&
      (typed !== search || applications.isFetching || jobs.isFetching),
  };
}

interface JumpPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** Type to find a page, a setting, an application or a job; arrows and Enter pick one. */
export function JumpPalette(props: JumpPaletteProps): ReactElement {
  const { open, onClose } = props;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Jump to"
      // Pinned high, so the box stays put while results grow and shrink under it.
      sx={{ "& .MuiDialog-container": { alignItems: "flex-start" } }}
      slotProps={{ paper: { sx: { mt: { xs: 2, sm: "12vh" }, overflow: "hidden" } } }}
    >
      {open && <JumpBody onClose={onClose} />}
    </Dialog>
  );
}

interface JumpBodyProps {
  onClose: () => void;
}

function JumpBody(props: JumpBodyProps): ReactElement {
  const { onClose } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { groups, searching } = useJumpGroups(query);
  const targets = groups.flatMap((group) => group.targets);
  const current = targets[Math.min(active, targets.length - 1)] ?? null;

  useEffect(() => {
    if (current) {
      document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    }
  });

  const go = (target: JumpTarget): void => {
    onClose();
    router.push(target.href);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const count = targets.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setActive((Math.min(active, count - 1) + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setActive((Math.min(active, count - 1) - 1 + count) % count);
    } else if (event.key === "Enter" && current) {
      event.preventDefault();
      go(current);
    }
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: "center", px: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Search fontSize="md" sx={{ color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Jump to a page, setting, application or job…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          inputProps={{
            "aria-label": "Jump to",
            role: "combobox",
            "aria-expanded": true,
            "aria-controls": "jump-results",
            "aria-activedescendant": current ? optionId(current) : undefined,
          }}
          sx={{ py: 1.75, typography: "body1" }}
        />
      </Stack>
      <Box
        id="jump-results"
        role="listbox"
        sx={{ maxHeight: { xs: "60vh", sm: 420 }, overflowY: "auto", py: 1 }}
      >
        {groups.length === 0 && (
          <Typography variant="body2Muted" sx={{ display: "block", px: 2, py: 3 }}>
            {searching ? "Searching…" : `Nothing matches "${query.trim()}".`}
          </Typography>
        )}
        {groups.map((group) => (
          <Box key={group.label} role="group" aria-label={group.label}>
            <Typography variant="overlineMuted" sx={{ display: "block", px: 2, pt: 1, pb: 0.5 }}>
              {group.label}
            </Typography>
            {group.targets.map((target) => (
              <JumpOption
                key={target.id}
                target={target}
                selected={target === current}
                onHover={() => setActive(targets.indexOf(target))}
                onPick={() => go(target)}
              />
            ))}
          </Box>
        ))}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          display: { xs: "none", sm: "flex" },
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          backgroundColor: "surfaces.panel",
        }}
      >
        <Typography variant="captionMuted">↑↓ to move</Typography>
        <Typography variant="captionMuted">Enter to open</Typography>
        <Typography variant="captionMuted">Esc to close</Typography>
      </Stack>
    </>
  );
}

function optionId(target: JumpTarget): string {
  return `jump-${target.id}`;
}

interface JumpOptionProps {
  target: JumpTarget;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
}

function JumpOption(props: JumpOptionProps): ReactElement {
  const { target, selected, onHover, onPick } = props;
  const Icon = target.icon;
  return (
    <ButtonBase
      id={optionId(target)}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onMouseMove={onHover}
      onClick={onPick}
      sx={(theme) => ({
        width: "100%",
        justifyContent: "flex-start",
        gap: 1.5,
        px: 2,
        py: 1,
        textAlign: "left",
        // The app's selection: a neutral lift with an accent edge, not an orange fill.
        ...(selected && {
          backgroundColor: theme.palette.surfaces.elevated,
          boxShadow: `inset 2px 0 0 ${theme.palette.accent.primary}`,
        }),
      })}
    >
      <Icon fontSize="md" sx={{ color: selected ? "accent.primary" : "text.secondary" }} />
      <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
        {target.label}
      </Typography>
      <Typography variant="captionMuted" noWrap sx={{ ml: "auto", flexShrink: 0, pl: 1 }}>
        {target.hint}
      </Typography>
    </ButtonBase>
  );
}
