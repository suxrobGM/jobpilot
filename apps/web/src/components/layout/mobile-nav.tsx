"use client";

import { type ReactElement, useEffect, useState } from "react";
import { MoreHoriz, Terminal } from "@mui/icons-material";
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutMenuItem } from "@/components/features/auth";
import { useSession } from "@/hooks/use-auth";
import { isAdminRole } from "@/lib/roles";
import { useAgentDrawer } from "@/providers/agent-provider";
import { NavBadge } from "./nav-badge";
import {
  ADMIN_NAV_ITEM,
  feedbackLinks,
  isNavEntryActive,
  MOBILE_NAV_HEIGHT,
  type NavItem,
  SETTINGS_NAV_ITEM,
} from "./shell-config";
import { useNavGroups } from "./use-nav-groups";

const MORE_VALUE = "more";

export function MobileNav(): ReactElement {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { watchSteps } = useAgentDrawer();
  const user = useSession();

  // Close after the route commit: closing in the click lets the transition interrupt the
  // Modal's exit and strand its invisible backdrop over the app.
  useEffect(() => {
    if (pathname) {
      setMoreOpen(false);
    }
  }, [pathname]);

  const allItems = useNavGroups().flatMap((group) => group.items);
  const footerItems = isAdminRole(user?.role)
    ? [SETTINGS_NAV_ITEM, ADMIN_NAV_ITEM]
    : [SETTINGS_NAV_ITEM];
  const primaryItems = allItems.filter((item) => item.primary);

  // The sidebar pins these to its foot, so they land at the end of the drawer here.
  const moreItems = [...allItems.filter((item) => !item.primary), ...footerItems];

  const activePrimary = primaryItems.find((item) => isNavEntryActive(pathname, item));
  const moreActive = moreItems.some((item) => isNavEntryActive(pathname, item));
  const value = activePrimary?.href ?? (moreActive ? MORE_VALUE : false);
  // More carries a badge only while a badged item lives in the drawer.
  const moreBadge = moreItems.find((item) => item.badge)?.badge;

  const renderTab = (item: NavItem): ReactElement => (
    <BottomNavigationAction
      key={item.href}
      component={Link}
      href={item.href}
      value={item.href}
      label={item.label}
      icon={
        <NavBadge badge={item.badge}>
          <item.icon fontSize="md" />
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
          borderTop: 1,
          borderColor: "divider",
          backgroundColor: theme.palette.surfaces.base,
          // Five tabs at MUI's 80px minimum overflow a 390px phone - share the width evenly instead.
          "& .MuiBottomNavigationAction-root": { minWidth: 0, paddingInline: 0.5 },
          "& .MuiBottomNavigationAction-label": {
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            // Overline size so five labels fit a 360px phone. Both states, or MUI grows the
            // selected label to 0.875rem and re-clips the active tab.
            fontSize: theme.typography.overline.fontSize,
            "&.Mui-selected": { fontSize: theme.typography.overline.fontSize },
          },
        })}
      >
        {primaryItems.map(renderTab)}
        <BottomNavigationAction
          value={MORE_VALUE}
          label="More"
          icon={
            <NavBadge badge={moreBadge}>
              <MoreHoriz fontSize="md" />
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
              href={item.href}
              selected={isNavEntryActive(pathname, item)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <NavBadge badge={item.badge}>
                  <item.icon fontSize="md" />
                </NavBadge>
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton
            onClick={() => {
              setMoreOpen(false);
              watchSteps();
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Terminal fontSize="md" />
            </ListItemIcon>
            <ListItemText primary="Agent" />
          </ListItemButton>
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
                <link.icon fontSize="md" />
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
