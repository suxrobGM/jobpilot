import type { PropsWithChildren, ReactNode } from "react";
import {
  NeedsYouBadge,
  NeedsYouCount,
} from "@/components/features/pilot/attention/needs-you-badge";
import type { NavItem } from "./shell-config";

interface NavBadgeProps extends PropsWithChildren {
  badge: NavItem["badge"];
  variant?: "standard" | "dot";
}

export function NavBadge(props: NavBadgeProps): ReactNode {
  const { badge, variant, children } = props;

  if (badge === "needsYou") {
    return <NeedsYouBadge variant={variant}>{children}</NeedsYouBadge>;
  }
  return children;
}

interface NavCountProps {
  badge: NavItem["badge"];
}

export function NavCount(props: NavCountProps): ReactNode {
  const { badge } = props;
  return badge === "needsYou" && <NeedsYouCount />;
}
