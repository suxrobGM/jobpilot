"use client";

import type { ReactElement } from "react";
import { Button, ButtonBase, Divider, Drawer, Grid, ListItem, ListItemAvatar } from "@mui/material";
import { AgentOrb } from "@/components/features/agent/agent-orb";
import { useAgentActivity } from "@/components/features/agent/use-agent-activity";
import { LogoutButton } from "@/components/features/auth";
import { useSession } from "@/hooks/use-auth";
import { useAgentDrawer } from "@/providers/agent-provider";
import { UserAvatar, UserIdentity } from "./account-menu";
import { NavItem } from "./nav-item";
import { RailLabel, railTile } from "./rail-tile";
import { feedbackLinks, type NavItem as NavItemType } from "./shell-config";

interface AgentTileProps {
  onClose: () => void;
}

function AgentTile(props: AgentTileProps): ReactElement {
  const { onClose } = props;
  const { watchSteps } = useAgentDrawer();
  const { orb } = useAgentActivity();

  return (
    <ButtonBase
      onClick={() => {
        onClose();
        watchSteps();
      }}
      sx={railTile(false)}
    >
      <AgentOrb state={orb} size="lg" />
      <RailLabel>Agent</RailLabel>
    </ButtonBase>
  );
}

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  items: NavItemType[];
}

/** Links close through the caller's pathname effect; actions that stay on the page call `onClose`. */
export function MoreSheet(props: MoreSheetProps): ReactElement {
  const { open, onClose, items } = props;
  const user = useSession();

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Grid container component="nav" aria-label="More pages" spacing={1} sx={{ p: 2 }}>
        {items.map((item) => (
          <Grid key={item.href} size={4}>
            <NavItem item={item} />
          </Grid>
        ))}
        <Grid size={4}>
          <AgentTile onClose={onClose} />
        </Grid>
      </Grid>
      {user && (
        <>
          <Divider />
          <ListItem secondaryAction={<LogoutButton onClick={onClose} />}>
            <ListItemAvatar>
              <UserAvatar user={user} />
            </ListItemAvatar>
            <UserIdentity user={user} />
          </ListItem>
          <Divider />
          <Grid container spacing={1} sx={{ p: 2 }}>
            {feedbackLinks.map((link) => (
              <Grid key={link.href} size={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<link.icon />}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                >
                  {link.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Drawer>
  );
}
