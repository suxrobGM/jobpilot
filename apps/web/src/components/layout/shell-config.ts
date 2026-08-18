import {
  AdminPanelSettings,
  BugReport,
  BusinessCenter,
  Dashboard,
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
} from "@mui/icons-material";
import { BUG_REPORT_URL, FEATURE_REQUEST_URL } from "@/lib/constants";
import { isAdminRole } from "@/lib/roles";

export interface NavItem {
  label: string;
  href: string;
  icon: SvgIconComponent;
  /** Shown only to ADMIN/SUPER_ADMIN. Cosmetic - the API's requireRole is the real gate. */
  adminOnly?: boolean;
  /** Live attention badge on the icon: open pilot questions, or inbox mail awaiting a decision. */
  badge?: "questions" | "reviews";
  /** Gets its own tab on the mobile bottom nav; the rest fall into its "More" sheet. */
  primary?: boolean;
  /** Extra pathname prefixes that keep this item highlighted (e.g. detail routes living outside its href). */
  matchHrefs?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { label: "Workspace", href: "/workspace", icon: Dashboard, primary: true },
      { label: "Pilot", href: "/pilot", icon: SmartToy, badge: "questions", primary: true },
      { label: "Inbox", href: "/inbox", icon: Inbox, badge: "reviews", primary: true },
      { label: "Analytics", href: "/analytics", icon: Insights, primary: true },
    ],
  },
  {
    label: "Channels",
    items: [
      { label: "Upwork", href: "/upwork", icon: Handshake },
      { label: "Networking", href: "/networking", icon: Forum },
    ],
  },
  {
    label: "Library",
    items: [
      {
        label: "Documents",
        href: "/documents",
        icon: Description,
        // Detail routes stayed at their old prefixes; keep Documents lit while viewing them.
        matchHrefs: ["/resumes", "/cover-letters"],
      },
      { label: "Boards", href: "/boards", icon: BusinessCenter },
      { label: "Portfolio", href: "/portfolio", icon: Public },
    ],
  },
];

/** Pinned to the foot of the rail, by the feedback and account controls - not part of the app's own nav. */
export const footerNavGroups: NavGroup[] = [
  {
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Admin", href: "/admin", icon: AdminPanelSettings, adminOnly: true },
    ],
  },
];

/** The nav a given role may see. The rail and the mobile nav render from this, never from the raw groups. */
export function visibleNavGroups(role: string | undefined, groups = navGroups): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdminRole(role)),
    }))
    .filter((group) => group.items.length > 0);
}

/** External GitHub issue links - rendered as plain anchors, never through navGroups/next-link. */
export const feedbackLinks: NavItem[] = [
  { label: "Report a Bug", href: BUG_REPORT_URL, icon: BugReport },
  { label: "Feature Request", href: FEATURE_REQUEST_URL, icon: Lightbulb },
];

export const APP_TITLE = "JobPilot";
export const RAIL_WIDTH = 56;
export const DOCK_COLLAPSED = 56;
export const DOCK_EXPANDED = 380;
export const DOCK_MIN_EXPANDED = 320;
export const DOCK_MAX_EXPANDED = 640;
export const MOBILE_NAV_HEIGHT = 56;

function isHrefActive(pathname: string, href: string): boolean {
  const target = href.split("?")[0];
  return target === "/" ? pathname === "/" : pathname.startsWith(target);
}

/** Active-route test shared by the desktop rail and the mobile bottom nav: the item's own href plus any matchHrefs prefixes. */
export function isNavEntryActive(pathname: string, item: NavItem): boolean {
  return (
    isHrefActive(pathname, item.href) ||
    (item.matchHrefs?.some((href) => isHrefActive(pathname, href)) ?? false)
  );
}
