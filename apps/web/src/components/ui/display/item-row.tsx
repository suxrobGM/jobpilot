import type { ReactElement, ReactNode } from "react";
import { List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { radii } from "@/theme";

interface ItemListProps {
  children: ReactNode;
}

/** ItemRow renders a ListItem, so it needs a List parent - this is that parent. */
export function ItemList(props: ItemListProps): ReactElement {
  const { children } = props;
  return (
    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {children}
    </List>
  );
}

interface ItemRowProps {
  icon?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  action?: ReactNode;
}

export function ItemRow(props: ItemRowProps): ReactElement {
  const { icon, primary, secondary, action } = props;

  return (
    <ListItem
      secondaryAction={action}
      sx={{
        border: 1,
        borderColor: "line.border",
        borderRadius: radii.md,
        pl: 1.5,
        // secondaryAction is absolutely positioned; 6 clears it, or noWrap text slides underneath.
        pr: action ? 6 : 1.5,
        py: 1,
      }}
    >
      {icon && <ListItemIcon sx={{ minWidth: "auto", mr: 1.5 }}>{icon}</ListItemIcon>}
      <ListItemText
        primary={primary}
        secondary={secondary}
        slotProps={{
          // component: div so a composed primary (title + trailing chip) is valid inside it.
          primary: { variant: "body2Strong", component: "div" },
          secondary: { variant: "captionMuted", component: "div" },
        }}
      />
    </ListItem>
  );
}
