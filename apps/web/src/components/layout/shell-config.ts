import {
  AdminPanelSettings,
  BugReport,
  Description,
  Forum,
  Handshake,
  Inbox,
  Insights,
  Lightbulb,
  Public,
  Settings,
  SmartToy,
  type SvgIconComponent,
  TravelExplore,
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
      {
        label: "Resumes",
        href: "/resumes",
        icon: Description,
        primary: true,
        // Cover letters are the second tab, on their own route.
        matchHrefs: ["/cover-letters"],
      },
      { label: "Analytics", href: "/analytics", icon: Insights },
      { label: "Portfolio", href: "/portfolio", icon: Public },
      { label: "Job boards", href: "/boards", icon: TravelExplore },
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
// Fits "Networking", the longest one-word label, at caption size.
export const RAIL_WIDTH = 84;
export const MOBILE_NAV_HEIGHT = 56;
export const TOP_BAR_HEIGHT = { mobile: 56, desktop: 64 } as const;

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
