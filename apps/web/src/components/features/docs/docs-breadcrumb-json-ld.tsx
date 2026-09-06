"use client";

import type { ReactElement } from "react";
import { usePathname } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbLd } from "@/lib/structured-data";
import { DOCS_NAV } from "./docs-nav";

/** Emits a BreadcrumbList for the active docs page (Home › Docs › <guide>), keyed off the path. */
export function DocsBreadcrumbJsonLd(): ReactElement {
  const pathname = usePathname();
  const trail = [
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
  ];
  const entry = DOCS_NAV.find((e) => e.href === pathname);
  if (entry) {
    trail.push({ name: entry.title, path: entry.href });
  }
  return <JsonLd data={breadcrumbLd(trail)} />;
}
