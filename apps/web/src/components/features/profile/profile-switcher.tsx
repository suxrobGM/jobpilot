"use client";

import { useState, type MouseEvent, type ReactElement } from "react";
import { Add, Check, DeleteOutlined } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type {
  DeleteProfileResponse,
  ProfileListItemDto,
  SetActiveProfileResponse,
} from "@/api/types";
import { LogoutMenuItem } from "@/components/features/auth";
import { useConfirm } from "@/providers/confirm-provider";

function initials(p: ProfileListItemDto): string {
  const first = p.firstName?.[0] ?? "";
  const last = p.lastName?.[0] ?? "";
  const both = `${first}${last}`.trim();
  if (both) {
    return both.toUpperCase();
  }
  return p.email?.[0]?.toUpperCase() ?? "?";
}

function displayName(p: ProfileListItemDto): string {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || p.email || "Untitled profile";
}

export function ProfileSwitcher(): ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const profilesQuery = useApiQuery<ProfileListItemDto[]>(queryKeys.profiles.list(), () =>
    apiClient.get<ProfileListItemDto[]>("/api/profiles"),
  );

  const switchTo = useApiMutation<SetActiveProfileResponse, number>(
    (profileId) => apiClient.post("/api/profiles/active", { profileId }),
    {
      invalidate: [queryKeys.profiles.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
        setAnchor(null);
      },
    },
  );

  const remove = useApiMutation<DeleteProfileResponse, number>(
    (profileId) => apiClient.del<DeleteProfileResponse>(`/api/profiles/${profileId}`),
    {
      successMessage: "Profile deleted",
      invalidate: [queryKeys.profiles.all],
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.refresh();
      },
    },
  );

  const profiles = profilesQuery.data ?? [];

  if (profiles.length === 0) {
    return <></>;
  }

  const active = profiles.find((p) => p.isActive) ?? profiles[0]!;
  const canDelete = profiles.length > 1;

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleSelect = (id: number) => {
    if (id === active.id) {
      setAnchor(null);
      return;
    }
    switchTo.mutate(id);
  };

  const handleCreate = () => {
    setAnchor(null);
    router.push("/onboarding?new=1");
  };

  const handleDelete = async (e: MouseEvent<HTMLElement>, profile: ProfileListItemDto) => {
    e.stopPropagation();
    setAnchor(null);
    const confirmed = await confirm({
      title: `Delete "${displayName(profile)}"?`,
      description:
        "This permanently removes the profile along with its resumes, applications, campaigns, credentials, and job boards. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(profile.id);
    }
  };

  return (
    <Box sx={{ pb: 1 }}>
      <Tooltip title={displayName(active)} placement="right">
        <IconButton
          aria-label={`Active profile: ${displayName(active)}. Click to switch.`}
          aria-haspopup="menu"
          aria-controls={open ? "profile-switcher-menu" : undefined}
          aria-expanded={open}
          onClick={handleOpen}
          sx={(theme) => ({
            p: 0,
            borderRadius: theme.radii.sm,
            "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
          })}
        >
          <Avatar
            sx={(theme) => ({
              width: 36,
              height: 36,
              fontSize: 14,
              fontWeight: 600,
              bgcolor: theme.palette.accent.primary,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.line.borderHi}`,
            })}
          >
            {initials(active)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id="profile-switcher-menu"
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          list: { "aria-label": "Switch profile", dense: true },
          paper: { sx: { minWidth: 260 } },
        }}
      >
        {profiles.map((p) => {
          const isCurrent = p.id === active.id;
          return (
            <MenuItem
              key={p.id}
              onClick={() => handleSelect(p.id)}
              aria-current={isCurrent ? "true" : undefined}
              selected={isCurrent}
              sx={{ pr: canDelete ? 1 : undefined }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {isCurrent && <Check fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={displayName(p)}
                secondary={p.email || undefined}
                slotProps={{
                  primary: { variant: "body2" },
                  secondary: { variant: "caption" },
                }}
              />
              {canDelete && (
                <IconButton
                  edge="end"
                  size="small"
                  aria-label={`Delete ${displayName(p)}`}
                  onClick={(e) => handleDelete(e, p)}
                  sx={{ ml: 1, color: "text.secondary" }}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              )}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={handleCreate}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Create new profile" />
        </MenuItem>
        <Divider />
        <LogoutMenuItem onClick={handleClose} />
      </Menu>
    </Box>
  );
}
