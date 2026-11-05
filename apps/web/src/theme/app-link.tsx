"use client";

import type { ComponentProps, ReactElement } from "react";
import NextLink from "next/link";

type AppLinkProps = ComponentProps<typeof NextLink>;

const EXTERNAL_HREF = /^https?:\/\//;

/** NextLink for app routes; an absolute URL opens in a new tab, so no call site repeats target/rel. */
export function AppLink(props: AppLinkProps): ReactElement {
  const { href, prefetch, replace, scroll, ...rest } = props;
  // A download stays in this tab: a new one would flash open and close around it.
  if (typeof href === "string" && EXTERNAL_HREF.test(href) && !rest.download) {
    return <a href={href} target="_blank" rel="noopener noreferrer" {...rest} />;
  }
  return <NextLink href={href} prefetch={prefetch} replace={replace} scroll={scroll} {...rest} />;
}
