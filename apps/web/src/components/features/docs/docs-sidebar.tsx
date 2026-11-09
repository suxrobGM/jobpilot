"use client";

import type { ReactElement } from "react";
import { SideNav } from "@/components/ui/navigation";
import { DOCS_LINKS } from "./docs-nav";

const GROUPS = [{ label: "Docs", links: DOCS_LINKS }];

/** The docs layout pins this column; on phones it is one scrolling row above the page. */
export function DocsSidebar(): ReactElement {
  return <SideNav label="Documentation" groups={GROUPS} />;
}
