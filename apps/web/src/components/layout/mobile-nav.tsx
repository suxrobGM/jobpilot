"use client";

import { type ReactElement, useState } from "react";
import { MoreHoriz } from "@mui/icons-material";
import {
  Badge,
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
import { useOpenQuestions } from "@/components/features/pilot/use-open-questions";
import { useAuth } from "@/hooks/use-auth";
import {
  feedbackLinks,
  footerNavGroups,
  isNavEntryActive,
  MOBILE_NAV_HEIGHT,
  type NavItem,
  visibleNavGroups,
} from "./shell-config";

const MORE_VALUE = "more";
const PRIMARY_HREFS = ["/workspace", "/pilot", "/inbox", "/analytics"];
/** Below MUI's 0.75rem default - "Workspace" has to fit a fifth of a 360px phone. */
const LABEL_SIZE = "0.6875rem";

/**
 * Bottom tab bar shown below md in place of the desktop rail: four primary
 * destinations plus a "More" sheet listing the rest and the sign-out action.
 */
export function MobileNav(): ReactElement {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const { count: questionCount } = useOpenQuestions();

  // Derived per render, not at module scope: the visible set depends on the signed-in role.
  const allItems = visibleNavGroups(user?.role).flatMap((group) => group.items);
  const footerItems = visibleNavGroups(user?.role, footerNavGroups).flatMap((group) => group.items);
  const primaryItems = allItems.filter((item) => PRIMARY_HREFS.includes(item.href));

  // The rail pins these to its foot, so they land at the end of the drawer here.
  const moreItems = [
    ...allItems.filter((item) => !PRIMARY_HREFS.includes(item.href)),
    ...footerItems,
  ];

  const activePrimary = primaryItems.find((item) => isNavEntryActive(pathname, item));
  const moreActive = moreItems.some((item) => isNavEntryActive(pathname, item));
  const value = activePrimary?.href ?? (moreActive ? MORE_VALUE : false);
  // Pilot sits on the tab bar now; only badge More when a badged item actually lives in the drawer.
  const moreHasQuestions = moreItems.some((item) => item.badge === "questions");

  const renderTab = (item: NavItem): ReactElement => (
    <BottomNavigationAction
      key={item.href}
      component={Link}
      href={item.href as Route}
      value={item.href}
      label={item.label}
      icon={
        item.badge === "questions" ? (
          <Badge badgeContent={questionCount} color="error" max={99}>
            <item.icon fontSize="small" />
          </Badge>
        ) : (
          <item.icon fontSize="small" />
        )
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
            <Badge badgeContent={moreHasQuestions ? questionCount : 0} color="error" max={99}>
              <MoreHoriz fontSize="small" />
            </Badge>
          }
          onClick={() => setMoreOpen(true)}
        />
      </BottomNavigation>

      <Drawer anchor="bottom" open={moreOpen} onClose={() => setMoreOpen(false)}>
        {/* MenuList (not List): MUI 9 MenuItem throws without a MenuListContext. */}
        <MenuList sx={{ pb: 1 }}>
          {moreItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href as Route}
              selected={isNavEntryActive(pathname, item)}
              onClick={() => setMoreOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.badge === "questions" ? (
                  <Badge badgeContent={questionCount} color="error" max={99}>
                    <item.icon fontSize="small" />
                  </Badge>
                ) : (
                  <item.icon fontSize="small" />
                )}
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
