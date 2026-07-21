import type { ReactElement, ReactNode } from "react";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";

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
        borderRadius: (theme) => `${theme.radii.md}px`,
        px: 1.5,
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
