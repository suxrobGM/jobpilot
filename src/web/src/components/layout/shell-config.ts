import {
  BusinessCenter,
  Inbox,
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
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Resumes", href: "/resumes", icon: Storage },
      { label: "Boards", href: "/boards", icon: BusinessCenter },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const APP_TITLE = "JobPilot";
export const APP_SIGIL = "◇"; // ◇
export const RAIL_WIDTH = 56;
export const DOCK_COLLAPSED = 56;
export const DOCK_EXPANDED = 380;
