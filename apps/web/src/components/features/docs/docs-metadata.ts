import type { Metadata } from "next";
import { DOCS_NAV } from "./docs-nav";

export function buildDocsMetadata(slug: string, overrides?: { description?: string }): Metadata {
  const href = `/docs/${slug}`;
  const entry = DOCS_NAV.find((e) => e.href === href);
  const title = entry?.title ?? "Docs";
  const description = overrides?.description ?? entry?.description ?? "";
  const ogTitle = `${title} · JobPilot`;
  return {
    title,
    description,
    alternates: { canonical: href },
    openGraph: { type: "article", url: href, title: ogTitle, description },
    twitter: { title: ogTitle, description },
  };
}
