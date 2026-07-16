import {
  AdminPanelSettings,
  BugReport,
  BusinessCenter,
  Dashboard,
  Description,
  FlightTakeoff,
  Forum,
  Handshake,
  Inbox,
  Insights,
  Lightbulb,
  Settings,
  Storage,
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
  /** Live attention badge on the icon; "questions" shows the open-question count. */
  badge?: "questions";
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Workspace", href: "/workspace", icon: Dashboard },
      { label: "Pilot", href: "/pilot", icon: FlightTakeoff, badge: "questions" },
      { label: "Analytics", href: "/analytics", icon: Insights },
      { label: "Upwork", href: "/upwork", icon: Handshake },
      { label: "Outreach", href: "/outreach", icon: Forum },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Resumes", href: "/resumes", icon: Storage },
      { label: "Cover Letters", href: "/cover-letters", icon: Description },
      { label: "Boards", href: "/boards", icon: BusinessCenter },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Pinned to the foot of the rail, by the feedback and account controls - not part of the app's own nav. */
export const footerNavGroups: NavGroup[] = [
  {
    items: [{ label: "Admin", href: "/admin", icon: AdminPanelSettings, adminOnly: true }],
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

/** Active-route test shared by the desktop rail and the mobile bottom nav. */
export function isNavItemActive(pathname: string, href: string): boolean {
  const target = href.split("?")[0];
  return target === "/" ? pathname === "/" : pathname.startsWith(target);
}
