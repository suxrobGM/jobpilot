import type { ReactElement } from "react";
import type { Route } from "next";
import { LinkButton } from "@/components/ui/buttons";

export interface EdgeLinkButtonProps {
  label: string;
  href: Route;
}

/** A text link whose label ends flush with the panel edge, like the numbers above it. */
export function EdgeLinkButton(props: EdgeLinkButtonProps): ReactElement {
  const { label, href } = props;
  return (
    <LinkButton size="small" href={href} sx={{ minWidth: 0, px: 1, mr: -1, flexShrink: 0 }}>
      {label}
    </LinkButton>
  );
}
