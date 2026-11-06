import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { AddBoardButton } from "@/components/features/boards/add-board-button";
import { BoardsContent } from "@/components/features/boards/boards-content";

export const metadata: Metadata = { title: "Job boards" };

export default function BoardsSettingsPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="body2Muted" sx={{ flex: 1 }}>
          Sites the pilot searches and applies on. Logins for them live under Credentials.
        </Typography>
        <AddBoardButton />
      </Stack>
      <BoardsContent />
    </Stack>
  );
}
