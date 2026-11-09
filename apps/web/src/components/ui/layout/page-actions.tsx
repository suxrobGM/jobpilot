"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTopBarSlots } from "./top-bar-slots";

interface PageActionsProps {
  children: ReactNode;
}

/** Top-bar actions for one tab of a page whose layout owns the `PageHeader`. */
export function PageActions(props: PageActionsProps): ReactNode {
  const { children } = props;
  const { actions } = useTopBarSlots();
  return actions && createPortal(children, actions);
}
