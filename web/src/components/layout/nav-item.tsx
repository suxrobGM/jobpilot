"use client";

import { ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import type { NavItem as NavItemType } from "./shell-config";

interface NavItemProps {
  item: NavItemType;
}

export function NavItem(props: NavItemProps): ReactElement {
  const { item } = props;
  const pathname = usePathname();
  const Icon = item.icon;
  const targetPath = item.href.split("?")[0];
  const active =
    targetPath === "/" ? pathname === "/" : pathname.startsWith(targetPath);

  return (
    <ListItemButton
      component={Link}
      href={item.href}
      selected={active}
      sx={(t) => ({
        borderRadius: t.radii.sm,
        marginInline: 1,
        marginBlock: 0.25,
        paddingInline: 1.5,
        paddingBlock: 0.75,
        "&.Mui-selected": {
          backgroundColor: t.palette.surfaces.elevated,
          color: t.palette.accent.primary,
          "& .MuiListItemIcon-root": { color: t.palette.accent.primary },
        },
        "&.Mui-selected:hover": { backgroundColor: t.palette.surfaces.hover },
      })}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Icon fontSize="md" />
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{
          primary: {
            sx: { fontSize: "0.875rem", fontWeight: active ? 600 : 500 },
          },
        }}
      />
    </ListItemButton>
  );
}
