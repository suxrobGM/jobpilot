import {
  BusinessCenter,
  Description,
  Forum,
  Handshake,
  Inbox,
  Insights,
  Settings,
  Storage,
  ViewKanban,
  type SvgIconComponent,
} from "@mui/icons-material";

export interface NavItem {
  label: string;
  href: string;
  icon: SvgIconComponent;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Pipeline", href: "/", icon: ViewKanban },
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

export const APP_TITLE = "JobPilot";
export const RAIL_WIDTH = 56;
export const DOCK_COLLAPSED = 56;
export const DOCK_EXPANDED = 380;
export const DOCK_MIN_EXPANDED = 320;
export const DOCK_MAX_EXPANDED = 640;
