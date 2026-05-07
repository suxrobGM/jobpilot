"use client";

import type { ReactElement } from "react";
import { Box, List, Typography } from "@mui/material";
import { NavItem } from "./nav-item";
import type { NavGroup as NavGroupType } from "./shell-config";

interface NavGroupProps {
  group: NavGroupType;
}

export function NavGroup(props: NavGroupProps): ReactElement {
  const { group } = props;
  return (
    <Box sx={{ mb: 1.5 }}>
      {group.label && (
        <Typography variant="overlineMuted" sx={{ px: 2, pb: 0.5, display: "block" }}>
          {group.label}
        </Typography>
      )}
      <List disablePadding>
        {group.items.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </List>
    </Box>
  );
}
