"use client";

import { UPWORK_DOMAIN } from "@jobpilot/contracts/upwork";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { feedQueries, jobBoardQueries, pilotQueries } from "@/api/queries";
import { isNavEntryActive, NAV_GROUPS, type NavGroup, type NavItem } from "./shell-config";

/** The nav with each channel shown only once the user works it, or while its page is open. */
export function useNavGroups(): NavGroup[] {
  const pathname = usePathname();
  const { data: feeds } = useQuery(feedQueries.list());
  const { data: boards } = useQuery(jobBoardQueries.list());
  const { data: state } = useQuery(pilotQueries.state());

  const kinds = new Set(feeds?.map((feed) => feed.kind));
  const networking = state?.config.networking;
  const used: Record<NonNullable<NavItem["channel"]>, boolean> = {
    upwork: kinds.has("upwork") || (boards?.some((b) => b.domain === UPWORK_DOMAIN) ?? false),
    networking:
      kinds.has("networking") ||
      (networking !== undefined && (networking.email !== "off" || networking.linkedIn !== "off")),
  };

  const shown = (item: NavItem): boolean =>
    !item.channel || used[item.channel] || isNavEntryActive(pathname, item);

  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(shown) })).filter(
    (group) => group.items.length > 0,
  );
}
