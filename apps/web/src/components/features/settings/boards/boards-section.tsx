"use client";

import { type ReactElement, useState } from "react";
import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { Button, Checkbox, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { credentialQueries, jobBoardQueries, pilotQueries } from "@/api/queries";
import type { CredentialDto, JobBoardDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { AddBoardButton } from "@/components/features/boards/add-board-button";
import { TooltipIconButton } from "@/components/ui/buttons";
import { ItemList } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { BoardLoginDialog } from "./board-login-dialog";

function loginLabel(login: CredentialDto | null, hasDefault: boolean): string {
  if (login) {
    return `Login: ${login.email ?? "saved"}`;
  }
  return hasDefault ? "Uses your default login" : "No login";
}

/** Boards the pilot rotates through, each with its login. Rotation changes save at once. */
export function BoardsSection(): ReactElement {
  const confirm = useConfirm();
  const rotation = useQuery(pilotQueries.state()).data?.config.boards ?? [];
  const boards = useQuery(jobBoardQueries.list()).data ?? [];
  const credentials = useQuery(credentialQueries.list()).data ?? [];
  const [editing, setEditing] = useState<JobBoardDto | null>(null);
  const hasDefault = credentials.some((c) => c.kind === "default");
  const loginFor = (board: JobBoardDto): CredentialDto | null =>
    credentials.find((c) => c.kind === "board" && c.board?.domain === board.domain) ?? null;

  const saveRotation = useApiMutation(
    (next: string[]) => api.pilot.settings.patch({ boards: next }),
    { invalidate: [pilotQueries.state().queryKey] },
  );
  // Each change builds on the saved rotation, so edits wait for the previous save.
  const busy = saveRotation.isPending;

  const remove = useApiMutation((id: string) => api["job-boards"]({ id }).delete(), {
    successMessage: "Board removed",
    invalidate: [jobBoardQueries.all],
  });

  const handleRemove = async (board: JobBoardDto): Promise<void> => {
    const ok = await confirm({
      title: `Remove ${board.name}?`,
      description: "The pilot stops searching it. Its saved login stays until you remove it.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) {
      return;
    }
    if (rotation.includes(board.domain)) {
      saveRotation.mutate(rotation.filter((domain) => domain !== board.domain));
    }
    remove.mutate(board.id);
  };

  const toggle = (domain: string): void =>
    saveRotation.mutate(
      rotation.includes(domain) ? rotation.filter((d) => d !== domain) : [...rotation, domain],
    );

  const move = (domain: string, by: -1 | 1): void => {
    const from = rotation.indexOf(domain);
    const next = [...rotation];
    next.splice(from, 1);
    next.splice(from + by, 0, domain);
    saveRotation.mutate(next);
  };

  // Rotation order first, then the boards the pilot leaves alone.
  const ordered = [
    ...rotation.flatMap((domain) => boards.filter((board) => board.domain === domain)),
    ...boards.filter((board) => !rotation.includes(board.domain)),
  ];

  return (
    <SectionCard
      title="Job boards"
      description="Checked boards are searched in this order, one per cycle. With none checked, each search keeps its own board."
      actions={<AddBoardButton />}
    >
      {boards.length === 0 && (
        <Typography variant="body2Muted">
          No boards yet. Add one for the pilot to search.
        </Typography>
      )}
      {boards.length > 0 && (
        <ItemList>
          {ordered.map((board) => {
            const index = rotation.indexOf(board.domain);
            const login = loginFor(board);
            return (
              <Stack
                key={board.id}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", px: 1, py: 0.75 }}
              >
                <Checkbox
                  size="small"
                  checked={index >= 0}
                  disabled={busy}
                  onChange={() => toggle(board.domain)}
                  slotProps={{ input: { "aria-label": `Search ${board.name}` } }}
                />
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2Strong" noWrap>
                    {board.name}
                  </Typography>
                  <Typography variant="captionMuted" noWrap>
                    {`${board.domain} · ${loginLabel(login, hasDefault)}`}
                  </Typography>
                </Stack>
                <Button size="small" onClick={() => setEditing(board)}>
                  {login ? "Edit login" : "Add login"}
                </Button>
                <TooltipIconButton
                  title="Move up"
                  disabled={busy || index <= 0}
                  onClick={() => move(board.domain, -1)}
                >
                  <ArrowUpward fontSize="sm" />
                </TooltipIconButton>
                <TooltipIconButton
                  title="Move down"
                  disabled={busy || index < 0 || index === rotation.length - 1}
                  onClick={() => move(board.domain, 1)}
                >
                  <ArrowDownward fontSize="sm" />
                </TooltipIconButton>
                <TooltipIconButton title="Remove board" onClick={() => void handleRemove(board)}>
                  <Delete fontSize="sm" />
                </TooltipIconButton>
              </Stack>
            );
          })}
        </ItemList>
      )}
      {editing && (
        <BoardLoginDialog
          key={editing.id}
          board={editing}
          login={loginFor(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionCard>
  );
}
