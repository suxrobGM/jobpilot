"use client";

import { type MouseEvent, type ReactNode, useState } from "react";
import { Security } from "@mui/icons-material";
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
import NextLink from "next/link";
import type { AuthUserDto } from "@/api/types";
import { LogoutMenuItem } from "@/components/features/auth";
import { useSession } from "@/hooks/use-auth";

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

/**
 * Account avatar for the app rail. One profile per user, so this is an identity
 * + sign-out menu rather than a switcher. Shows the account's login email.
 */
export function AccountMenu(): ReactNode {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const { user } = useSession();

  if (!user) {
    return null;
  }

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const handleClose = () => setAnchor(null);

  return (
    <Box sx={{ pb: 1 }}>
      <Tooltip title={displayName(user)} placement="right">
        <IconButton
          aria-label={`Account: ${displayName(user)}`}
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
              ...theme.typography.body1Strong,
              bgcolor: theme.palette.accent.primary,
              color: "primary.contrastText",
              border: `1px solid ${theme.palette.line.borderHi}`,
            })}
          >
            {initials(user)}
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
            primary={displayName(user)}
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
        <LogoutMenuItem onClick={handleClose} />
      </Menu>
    </Box>
  );
}
