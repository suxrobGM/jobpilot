"use client";

import { type ReactElement, useEffect, useState } from "react";
import { MoreHoriz } from "@mui/icons-material";
import { BottomNavigation, BottomNavigationAction } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-auth";
import { isAdminRole } from "@/lib/roles";
import { MoreSheet } from "./more-sheet";
import { NavBadge } from "./nav-badge";
import {
  ADMIN_NAV_ITEM,
  isNavEntryActive,
  MOBILE_NAV_HEIGHT,
  type NavItem,
  SETTINGS_NAV_ITEM,
} from "./shell-config";
import { useNavGroups } from "./use-nav-groups";

const MORE_VALUE = "more";

interface MobileNavProps {
  /** Hidden, not unmounted: focus changes toggle it, and a remount reruns its queries. */
  hidden: boolean;
}

/** The phone's bottom bar; hidden from md, where the rail takes over. */
export function MobileNav(props: MobileNavProps): ReactElement {
  const { hidden } = props;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useSession();

  // Close after the route commit: closing in the click lets the transition interrupt the
  // Modal's exit and strand its invisible backdrop over the app.
  useEffect(() => {
    if (pathname) {
      setMoreOpen(false);
    }
  }, [pathname]);

  const allItems = useNavGroups().flatMap((group) => group.items);
  const primaryItems = allItems.filter((item) => item.primary);
  // The rail pins Settings and Admin to its foot, so they land at the end of the sheet here.
  const moreItems = [
    ...allItems.filter((item) => !item.primary),
    SETTINGS_NAV_ITEM,
    ...(user && isAdminRole(user.role) ? [ADMIN_NAV_ITEM] : []),
  ];

  const activePrimary = primaryItems.find((item) => isNavEntryActive(pathname, item));
  const moreActive = moreItems.some((item) => isNavEntryActive(pathname, item));
  const value = activePrimary?.href ?? (moreActive ? MORE_VALUE : false);
  // More carries a badge only while a badged item lives in the sheet.
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
          display: { xs: hidden ? "none" : "flex", md: "none" },
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

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
    </>
  );
}
