import {
  Article,
  Description,
  Flag,
  Handshake,
  Inbox,
  Mail,
  People,
  Settings,
  type SvgIconComponent,
  ViewKanban,
} from "@mui/icons-material";
import type { Route } from "next";
import type { NavGroup } from "@/components/layout/shell-config";
import { PIPELINE_TABS } from "../pipeline/pipeline-tabs";
import { SETTINGS_GROUPS } from "../settings/settings-nav";

export interface JumpTarget {
  id: string;
  label: string;
  /** Where it lives, shown muted beside the label and matched like it. */
  hint: string;
  href: Route;
  icon: SvgIconComponent;
}

interface SubPage {
  label: string;
  href: Route;
  icon: SvgIconComponent;
  /** The rail item it belongs to; hidden with it when that channel is off. */
  parent: string;
}

const SUB_PAGES: SubPage[] = [
  { label: "Goals & rules", href: "/pilot/goals", icon: Flag, parent: "Pilot" },
  ...PIPELINE_TABS.map((tab) => ({
    label: tab.label,
    href: `/pipeline?view=${tab.key}` as Route,
    icon: ViewKanban,
    parent: "Pipeline",
  })),
  { label: "Resumes", href: "/documents/resumes", icon: Description, parent: "Documents" },
  { label: "Cover letters", href: "/documents/cover-letters", icon: Article, parent: "Documents" },
  { label: "Proposals", href: "/upwork", icon: Handshake, parent: "Upwork" },
  { label: "Upwork inbox", href: "/upwork/inbox", icon: Inbox, parent: "Upwork" },
  { label: "Upwork profile", href: "/upwork/profile", icon: Handshake, parent: "Upwork" },
  { label: "Contacts", href: "/networking/contacts", icon: People, parent: "Networking" },
  { label: "Messages", href: "/networking/messages", icon: Mail, parent: "Networking" },
];

/** Every page the user can open from here: the rail, then the tabs and sections inside it. */
export function jumpPages(groups: NavGroup[], extra: NavGroup["items"]): JumpTarget[] {
  const items = [...groups.flatMap((group) => group.items), ...extra];
  const shown = new Set(items.map((item) => item.label));
  const pages = items.map((item) => ({
    id: `page:${item.href}`,
    label: item.label,
    hint: "Page",
    href: item.href,
    icon: item.icon,
  }));
  const subPages = SUB_PAGES.filter((page) => shown.has(page.parent)).map((page) => ({
    id: `sub:${page.href}`,
    label: page.label,
    hint: page.parent,
    href: page.href,
    icon: page.icon,
  }));
  const settings = SETTINGS_GROUPS.flatMap((group) =>
    group.links.map((link) => ({
      id: `settings:${link.href}`,
      label: link.label,
      hint: `Settings · ${group.label}`,
      href: link.href,
      icon: Settings,
    })),
  );
  return [...pages, ...subPages, ...settings];
}

/** Every word of the query appears in the label or the hint. */
export function matchesQuery(target: JumpTarget, query: string): boolean {
  const haystack = `${target.label} ${target.hint}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
