"use client";

import { type MouseEvent, type ReactNode, useState } from "react";
import { Security } from "@mui/icons-material";
import {
  Avatar,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import NextLink from "next/link";
import type { AuthUserDto } from "@/api/types";
import { LogoutMenuItem } from "@/components/features/auth";
import { useSession } from "@/hooks/use-auth";
import { isAdminRole } from "@/lib/roles";
import { ADMIN_NAV_ITEM, feedbackLinks } from "./shell-config";

function initials(u: AuthUserDto): string {
  const both = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.trim();
  if (both) {
    return both.toUpperCase();
  }
  return u.email?.[0]?.toUpperCase() ?? "?";
}

function displayName(u: AuthUserDto): string {
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || "Your profile";
}

/** One profile per user, so identity, feedback, admin and sign-out rather than a switcher. */
export function AccountMenu(): ReactNode {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const { user } = useSession();

  if (!user) {
    return null;
  }

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);
  const name = displayName(user);

  return (
    <>
      <Tooltip title={name} placement="right">
        <ButtonBase
          aria-label={`Account: ${name}`}
          aria-haspopup="menu"
          aria-controls={open ? "account-menu" : undefined}
          aria-expanded={open}
          onClick={handleOpen}
          sx={(theme) => ({
            alignSelf: "center",
            padding: 0.5,
            borderRadius: theme.radii.pill,
            "&:hover": { backgroundColor: theme.palette.surfaces.card },
            "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
          })}
        >
          <Avatar
            sx={(theme) => ({
              width: 32,
              height: 32,
              ...theme.typography.caption,
              bgcolor: theme.tints.selected,
              color: "accent.primary",
            })}
          >
            {initials(user)}
          </Avatar>
        </ButtonBase>
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
            primary={name}
            secondary={user.email || undefined}
            slotProps={{
              primary: { variant: "body2" },
              secondary: { variant: "caption" },
            }}
          />
        </MenuItem>
        <Divider />
        <MenuItem component={NextLink} href="/settings/security" onClick={handleClose}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Security fontSize="md" />
          </ListItemIcon>
          <ListItemText primary="Security settings" />
        </MenuItem>
        {isAdminRole(user.role) && (
          <MenuItem component={NextLink} href={ADMIN_NAV_ITEM.href} onClick={handleClose}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ADMIN_NAV_ITEM.icon fontSize="md" />
            </ListItemIcon>
            <ListItemText primary={ADMIN_NAV_ITEM.label} />
          </MenuItem>
        )}
        <Divider />
        {feedbackLinks.map((link) => (
          <MenuItem
            key={link.href}
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClose}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <link.icon fontSize="md" />
            </ListItemIcon>
            <ListItemText primary={link.label} />
          </MenuItem>
        ))}
        <Divider />
        <LogoutMenuItem onClick={handleClose} />
      </Menu>
    </>
  );
}
