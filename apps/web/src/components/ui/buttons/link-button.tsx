import type { ReactElement } from "react";
import { Button, type ButtonProps } from "@mui/material";
import type { Route } from "next";

type LinkButtonProps = Omit<ButtonProps, "component" | "LinkComponent" | "href"> & { href: Route };

/** No `component` prop: the theme already routes `href` through next/link, so this stays RSC. */
export function LinkButton(props: LinkButtonProps): ReactElement {
  return <Button {...props} />;
}
