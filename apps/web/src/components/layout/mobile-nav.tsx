"use client";

import { type ReactElement, useEffect, useState } from "react";
import { MoreHoriz } from "@mui/icons-material";
import {
  BottomNavigation,
  BottomNavigationAction,
  Divider,
  Drawer,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuList,
} from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutMenuItem } from "@/components/features/auth";
import { useSession } from "@/hooks/use-auth";
import { NavBadge } from "./nav-badge";
import {
  feedbackLinks,
  footerNavGroups,
  isNavEntryActive,
  MOBILE_NAV_HEIGHT,
  type NavItem,
  visibleNavGroups,
} from "./shell-config";

const MORE_VALUE = "more";
/** Below MUI's 0.75rem default - "Workspace" has to fit a fifth of a 360px phone. */
const LABEL_SIZE = "0.6875rem";

/**
 * Bottom tab bar shown below md in place of the desktop rail: four primary
 * destinations plus a "More" sheet listing the rest and the sign-out action.
 */
export function MobileNav(): ReactElement {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useSession();

  // Close the sheet after the route commit, not during the click: closing and navigating in the
  // same event lets the route transition interrupt the Modal's exit, stranding the invisible
  // backdrop / scroll-lock over the whole app (this persistent shell never unmounts it).
  useEffect(() => {
    if (pathname) {
      setMoreOpen(false);
    }
  }, [pathname]);

  // Derived per render, not at module scope: the visible set depends on the signed-in role.
  const allItems = visibleNavGroups(user?.role).flatMap((group) => group.items);
  const footerItems = visibleNavGroups(user?.role, footerNavGroups).flatMap((group) => group.items);
  const primaryItems = allItems.filter((item) => item.primary);

  // The rail pins these to its foot, so they land at the end of the drawer here.
  const moreItems = [...allItems.filter((item) => !item.primary), ...footerItems];

  const activePrimary = primaryItems.find((item) => isNavEntryActive(pathname, item));
  const moreActive = moreItems.some((item) => isNavEntryActive(pathname, item));
  const value = activePrimary?.href ?? (moreActive ? MORE_VALUE : false);
  // Pilot sits on the tab bar now; More carries a badge only while a badged item lives in the drawer.
  const moreBadge = moreItems.find((item) => item.badge)?.badge;

  const renderTab = (item: NavItem): ReactElement => (
    <BottomNavigationAction
      key={item.href}
      component={Link}
      href={item.href as Route}
      value={item.href}
      label={item.label}
      icon={
        <NavBadge badge={item.badge}>
          <item.icon fontSize="small" />
        </NavBadge>
      }
    />
  );

  return (
    <>
      <BottomNavigation
        component="nav"
        showLabels
        value={value}
        sx={(theme) => ({
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: MOBILE_NAV_HEIGHT,
          zIndex: theme.zIndex.appBar,
          borderTop: `1px solid ${theme.palette.line.divider}`,
          backgroundColor: theme.palette.surfaces.base,
          // Five tabs at MUI's 80px minimum overflow a 390px phone - share the width evenly instead.
          "& .MuiBottomNavigationAction-root": { minWidth: 0, paddingInline: 0.5 },
          "& .MuiBottomNavigationAction-label": {
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            // Both states, or MUI grows the selected label to 0.875rem and re-clips the active tab.
            fontSize: LABEL_SIZE,
            "&.Mui-selected": { fontSize: LABEL_SIZE },
          },
        })}
      >
        {primaryItems.map(renderTab)}
        <BottomNavigationAction
          value={MORE_VALUE}
          label="More"
          icon={
            <NavBadge badge={moreBadge}>
              <MoreHoriz fontSize="small" />
            </NavBadge>
          }
          onClick={() => setMoreOpen(true)}
        />
      </BottomNavigation>

      <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}>
        {/* MenuList (not List): MUI 9 MenuItem throws without a MenuListContext. */}
        <MenuList sx={{ pb: 1 }}>
          {/* No onClick close on nav items: the pathname effect closes after the commit. */}
          {moreItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href as Route}
              selected={isNavEntryActive(pathname, item)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <NavBadge badge={item.badge}>
                  <item.icon fontSize="small" />
                </NavBadge>
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 0.5 }} />
          {feedbackLinks.map((link) => (
            <ListItemButton
              key={link.href}
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMoreOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <link.icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <LogoutMenuItem onClick={() => setMoreOpen(false)} />
        </MenuList>
      </Drawer>
    </>
  );
}
