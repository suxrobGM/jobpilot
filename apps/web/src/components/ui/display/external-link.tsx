import type { ReactElement, ReactNode } from "react";
import { Link } from "@mui/material";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  /** Ellipsize onto one line at this width (px) - for table cells holding long URLs. */
  truncateTo?: number;
}

/** An inherited-color link for grid cells; the theme's link component opens it in a new tab. */
export function ExternalLink(props: ExternalLinkProps): ReactElement {
  const { href, children, truncateTo } = props;
  return (
    <Link
      href={href}
      color="inherit"
      sx={
        truncateTo
          ? {
              display: "block",
              maxWidth: truncateTo,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }
          : undefined
      }
    >
      {children}
    </Link>
  );
}
