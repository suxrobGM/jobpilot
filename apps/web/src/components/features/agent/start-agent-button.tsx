import type { ReactElement } from "react";
import { Button, type ButtonProps } from "@mui/material";
import { TERMINAL_PROTOCOL_URL } from "@/lib/terminal/client";

interface StartAgentButtonProps extends Pick<ButtonProps, "color" | "variant" | "sx"> {
  /** Marks a relaunch in flight, so health polls fast until the host answers. */
  onStart: () => void;
}

export function StartAgentButton(props: StartAgentButtonProps): ReactElement {
  const { onStart, variant = "contained", ...rest } = props;

  return (
    <Button
      variant={variant}
      size="small"
      component="a"
      href={TERMINAL_PROTOCOL_URL}
      onClick={onStart}
      {...rest}
    >
      Start agent
    </Button>
  );
}
