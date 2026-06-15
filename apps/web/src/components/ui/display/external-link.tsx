"use client";

import type { ReactElement, ReactNode } from "react";
import { Link } from "@mui/material";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
}

/** External link with standard new-tab / noopener / inherited-color styling (e.g. grid cells). */
export function ExternalLink(props: ExternalLinkProps): ReactElement {
  const { href, children } = props;
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" color="inherit">
      {children}
    </Link>
  );
}
