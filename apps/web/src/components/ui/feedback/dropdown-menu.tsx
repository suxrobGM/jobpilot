"use client";

import { useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";

/**
 * A single entry in a {@link DropdownMenu}. Pass `show: false` to hide it conditionally
 * without spreading `&&` checks across the JSX.
 */
export type DropdownMenuItem =
  | { kind: "divider"; key: string; show?: boolean }
  | {
      kind: "item";
      key: string;
      label: ReactNode;
      /** Leading icon, rendered inside a `ListItemIcon`. */
      icon?: ReactNode;
      /** Trailing slot (e.g. a count badge or keyboard hint). */
      trailing?: ReactNode;
      /** Fires after the menu closes. Omit when using `href` for plain navigation. */
      onClick?: () => void;
      /** Renders the item as a `next/link`. Use the `as Route` cast for typed routes. */
      href?: Route;
      disabled?: boolean;
      /** Tints the label red — for destructive actions like "Remove". */
      danger?: boolean;
      show?: boolean;
    };

interface DropdownMenuTriggerProps {
  /** Wire this to the trigger element's `onClick` to open the menu. */
  onOpen: (event: MouseEvent<HTMLElement>) => void;
  open: boolean;
}

interface DropdownMenuProps {
  /** Render-prop for the trigger element (Button, IconButton, etc.). */
  trigger: (props: DropdownMenuTriggerProps) => ReactElement;
  items: DropdownMenuItem[];
  minWidth?: number;
  /**
   * Stop click events from bubbling past the trigger and menu. Use when the menu sits
   * inside a clickable parent (e.g. a card with its own `onClick`).
   */
  stopPropagation?: boolean;
}

/**
 * Declarative dropdown menu. Pass a render-prop `trigger` and a flat `items` array;
 * dividers, conditional visibility, and `next/link` navigation are all handled inline.
 *
 * @example
 * <DropdownMenu
 *   trigger={({ onOpen }) => <IconButton onClick={onOpen}><MoreVert /></IconButton>}
 *   items={[
 *     { kind: "item", key: "edit", label: "Edit", onClick: handleEdit },
 *     { kind: "divider", key: "d1" },
 *     { kind: "item", key: "del", label: "Delete", danger: true, onClick: handleDelete },
 *   ]}
 * />
 */
export function DropdownMenu(props: DropdownMenuProps): ReactElement {
  const { trigger, items, minWidth = 200, stopPropagation = false } = props;
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

          const linkProps = item.href ? ({ component: Link, href: item.href } as const) : undefined;

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
