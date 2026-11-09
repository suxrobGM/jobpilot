"use client";

import type { ReactElement } from "react";
import { Logout } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useAuthActions } from "@/hooks/use-auth";

interface LogoutButtonProps {
  /** Called before the logout request fires (e.g. to close an open sheet). */
  onClick: () => void;
}

export function LogoutButton(props: LogoutButtonProps): ReactElement {
  const { onClick } = props;
  const { logout } = useAuthActions();

  return (
    <Button
      size="small"
      startIcon={<Logout />}
      disabled={logout.isPending}
      onClick={() => {
        onClick();
        logout.mutate();
      }}
    >
      {logout.isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
