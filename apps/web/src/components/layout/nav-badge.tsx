import type { PropsWithChildren, ReactNode } from "react";
import { QuestionBadge } from "@/components/features/pilot/attention/question-badge";
import type { NavItem } from "./shell-config";

interface NavBadgeProps extends PropsWithChildren {
  badge: NavItem["badge"];
}

export function NavBadge(props: NavBadgeProps): ReactNode {
  const { badge, children } = props;

  if (badge === "questions") {
    return <QuestionBadge>{children}</QuestionBadge>;
  }
  return children;
}
