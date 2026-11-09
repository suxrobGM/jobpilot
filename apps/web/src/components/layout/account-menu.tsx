"use client";

import { type MouseEvent, type ReactElement, type ReactNode, useEffect, useState } from "react";
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
import { usePathname } from "next/navigation";
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

/**
 * Identity, security, admin, feedback and sign-out: the rail's account menu, and the foot of the
 * phone's More sheet. An array, not a component: MenuList walks its direct children for focus.
 * `onClose` only runs for items that stay on the page; the caller closes on route change.
 */
export function accountMenuItems(user: AuthUserDto, onClose: () => void): ReactElement[] {
  return [
    <MenuItem key="who" disabled sx={{ opacity: "1 !important" }}>
      <ListItemText
        primary={displayName(user)}
        secondary={user.email || undefined}
        slotProps={{
          primary: { variant: "body2" },
          secondary: { variant: "caption" },
        }}
      />
    </MenuItem>,
    <Divider key="who-divider" />,
    <MenuItem key="security" component={NextLink} href="/settings/security">
      <ListItemIcon>
        <Security fontSize="md" />
      </ListItemIcon>
      <ListItemText primary="Security settings" />
    </MenuItem>,
    ...(isAdminRole(user.role)
      ? [
          <MenuItem key="admin" component={NextLink} href={ADMIN_NAV_ITEM.href}>
            <ListItemIcon>
              <ADMIN_NAV_ITEM.icon fontSize="md" />
            </ListItemIcon>
            <ListItemText primary={ADMIN_NAV_ITEM.label} />
          </MenuItem>,
        ]
      : []),
    <Divider key="feedback-divider" />,
    ...feedbackLinks.map((link) => (
      <MenuItem
        key={link.href}
        component="a"
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
      >
        <ListItemIcon>
          <link.icon fontSize="md" />
        </ListItemIcon>
        <ListItemText primary={link.label} />
      </MenuItem>
    )),
    <Divider key="logout-divider" />,
    <LogoutMenuItem key="logout" onClick={onClose} />,
  ];
}

/** The rail's avatar: one profile per user, so a menu rather than a switcher. */
export function AccountMenu(): ReactNode {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const pathname = usePathname();
  const user = useSession();

  // Close after the route commit, as the phone's More sheet does.
  useEffect(() => {
    if (pathname) {
      setAnchor(null);
    }
  }, [pathname]);

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
        {accountMenuItems(user, handleClose)}
      </Menu>
    </>
  );
}
