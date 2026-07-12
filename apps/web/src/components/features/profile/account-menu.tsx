"use client";

import { type MouseEvent, type ReactElement, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ProfileDto, ProfileResponse } from "@/api/types";
import { LogoutMenuItem } from "@/components/features/auth";

function initials(p: ProfileDto): string {
  const both = `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.trim();
  if (both) {
    return both.toUpperCase();
  }
  return p.email?.[0]?.toUpperCase() ?? "?";
}

function displayName(p: ProfileDto): string {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || p.email || "Your profile";
}

/**
 * Account avatar for the app rail. One profile per user, so this is an identity
 * + sign-out menu rather than a switcher. Reads the profile from `GET /profile`.
 */
export function AccountMenu(): ReactElement | null {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const profileQuery = useApiQuery<ProfileResponse, ProfileDto | null>(
    queryKeys.profile.detail(),
    () => api.profile.get(),
    { select: (data) => data.profile },
  );

  const profile = profileQuery.data;

  if (!profile) {
    return null;
  }

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  return (
    <Box sx={{ pb: 1 }}>
      <Tooltip title={displayName(profile)} placement="right">
        <IconButton
          aria-label={`Account: ${displayName(profile)}`}
          aria-haspopup="menu"
          aria-controls={open ? "account-menu" : undefined}
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
              color: "primary.contrastText",
              border: `1px solid ${theme.palette.line.borderHi}`,
            })}
          >
            {initials(profile)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id="account-menu"
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          list: { "aria-label": "Account", dense: true },
          paper: { sx: { minWidth: 220 } },
        }}
      >
        <MenuItem disabled sx={{ opacity: "1 !important" }}>
          <ListItemText
            primary={displayName(profile)}
            secondary={profile.email || undefined}
            slotProps={{
              primary: { variant: "body2" },
              secondary: { variant: "caption" },
            }}
          />
        </MenuItem>
        <Divider />
        <LogoutMenuItem onClick={handleClose} />
      </Menu>
    </Box>
  );
}
