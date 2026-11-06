import {
  AdminPanelSettings,
  BugReport,
  Description,
  Forum,
  Handshake,
  Inbox,
  Insights,
  Lightbulb,
  Settings,
  SmartToy,
  type SvgIconComponent,
  ViewKanban,
} from "@mui/icons-material";
import type { Route } from "next";
import { BUG_REPORT_URL, type ExternalUrl, FEATURE_REQUEST_URL } from "@/lib/constants";

export interface NavItem {
  label: string;
  href: Route;
  icon: SvgIconComponent;
  /** Live attention badge: open pilot questions. */
  badge?: "needsYou";
  /** Gets its own tab on the mobile bottom nav; the rest fall into its "More" sheet. */
  primary?: boolean;
  /** Extra pathname prefixes that keep this item highlighted (e.g. detail routes living outside its href). */
  matchHrefs?: string[];
  /** Shown only once the user works that channel (see `useNavGroups`). */
  channel?: "upwork" | "networking";
}

export interface NavGroup {
  /** Shown as a heading in the expanded sidebar. */
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Pilot", href: "/pilot", icon: SmartToy, badge: "needsYou", primary: true },
      { label: "Pipeline", href: "/pipeline", icon: ViewKanban, primary: true },
      { label: "Inbox", href: "/inbox", icon: Inbox, primary: true },
      { label: "Analytics", href: "/analytics", icon: Insights, primary: true },
      {
        label: "Documents",
        href: "/documents",
        icon: Description,
        // Document detail routes live outside /documents.
        matchHrefs: ["/resumes", "/cover-letters"],
      },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Upwork", href: "/upwork", icon: Handshake, channel: "upwork" },
      { label: "Networking", href: "/networking", icon: Forum, channel: "networking" },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = { label: "Settings", href: "/settings", icon: Settings };

/** Shown only to admin and super_admin. Cosmetic - the API's requireRole is the real gate. */
export const ADMIN_NAV_ITEM: NavItem = { label: "Admin", href: "/admin", icon: AdminPanelSettings };

interface ExternalNavLink {
  label: string;
  href: ExternalUrl;
  icon: SvgIconComponent;
}

/** GitHub issue links: off-site, so they stay out of the nav groups and their active matching. */
export const feedbackLinks: ExternalNavLink[] = [
  { label: "Report a Bug", href: BUG_REPORT_URL, icon: BugReport },
  { label: "Feature Request", href: FEATURE_REQUEST_URL, icon: Lightbulb },
];

export const APP_TITLE = "JobPilot";
export const SIDEBAR_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const MOBILE_NAV_HEIGHT = 56;

function isHrefActive(pathname: string, href: string): boolean {
  const target = href.split("?")[0];
  return target === "/" ? pathname === "/" : pathname.startsWith(target);
}

/** Active-route test shared by the sidebar and the mobile bottom nav: the item's own href plus any matchHrefs prefixes. */
export function isNavEntryActive(pathname: string, item: NavItem): boolean {
  return (
    isHrefActive(pathname, item.href) ||
    (item.matchHrefs?.some((href) => isHrefActive(pathname, href)) ?? false)
  );
}
