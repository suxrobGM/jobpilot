import type { PropsWithChildren, ReactNode } from "react";
import { NeedsYouBadge } from "@/components/features/pilot/attention/needs-you-badge";
import type { NavItem } from "./shell-config";

interface NavBadgeProps extends PropsWithChildren {
  badge: NavItem["badge"];
}

export function NavBadge(props: NavBadgeProps): ReactNode {
  const { badge, children } = props;

  if (badge === "needsYou") {
    return <NeedsYouBadge>{children}</NeedsYouBadge>;
  }
  return children;
}
