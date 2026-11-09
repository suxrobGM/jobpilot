"use client";

import { type MouseEvent, type ReactElement, type ReactNode, useState } from "react";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  type PopoverOrigin,
} from "@mui/material";
import type { Route } from "next";
import type { ExternalUrl } from "@/lib/constants";
import { AppLink } from "@/theme/app-link";

/** `show: false` hides an entry without `&&` checks across the JSX. */
type DropdownMenuItem =
  | { kind: "divider"; key: string; show?: boolean }
  | {
      kind: "item";
      key: string;
      label: ReactNode;
      icon?: ReactNode;
      trailing?: ReactNode;
      /** Fires after the menu closes. Omit when using `href` for plain navigation. */
      onClick?: () => void;
      /** Renders the item as a link; an off-site URL opens in a new tab. */
      href?: Route | ExternalUrl;
      disabled?: boolean;
      danger?: boolean;
      show?: boolean;
    };

interface DropdownMenuTriggerProps {
  onOpen: (event: MouseEvent<HTMLElement>) => void;
  open: boolean;
}

interface DropdownMenuProps {
  trigger: (props: DropdownMenuTriggerProps) => ReactElement;
  items: DropdownMenuItem[];
  minWidth?: number;
  /** For a menu inside a clickable parent, such as a card with its own `onClick`. */
  stopPropagation?: boolean;
  /** Defaults to below the trigger. */
  anchorOrigin?: PopoverOrigin;
  transformOrigin?: PopoverOrigin;
}

export function DropdownMenu(props: DropdownMenuProps): ReactElement {
  const {
    trigger,
    items,
    minWidth = 200,
    stopPropagation = false,
    anchorOrigin,
    transformOrigin,
  } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    setAnchor(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchor(null);
  };

  return (
    <>
      {trigger({ onOpen: handleOpen, open })}
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        slotProps={{ paper: { sx: { minWidth } } }}
      >
        {items.flatMap((item) => {
          if (item.show === false) {
            return [];
          }
          if (item.kind === "divider") {
            return [<Divider key={item.key} />];
          }

          const linkProps = item.href
            ? ({ component: AppLink, href: item.href } as const)
            : undefined;

          return [
            <MenuItem
              key={item.key}
              {...linkProps}
              disabled={item.disabled}
              onClick={() => {
                handleClose();
                item.onClick?.();
              }}
            >
              {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
              <ListItemText sx={item.danger ? { color: "error.main" } : undefined}>
                {item.label}
              </ListItemText>
              {item.trailing}
            </MenuItem>,
          ];
        })}
      </Menu>
    </>
  );
}
