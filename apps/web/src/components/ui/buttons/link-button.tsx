"use client";

import type { ReactElement } from "react";
import { Button, type ButtonProps } from "@mui/material";
import Link from "next/link";

type LinkButtonProps = Omit<ButtonProps<typeof Link>, "component">;

export function LinkButton(props: LinkButtonProps): ReactElement {
  return <Button component={Link} {...props} />;
}
