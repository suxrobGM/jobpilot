"use client";

import { Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { ReactElement } from "react";
import { StageChip } from "@/components/ui/display/stage-chip";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ApplicationDto } from "@/types/api";

export function RecentActivity(): ReactElement {
  const recent = useApiQuery<ApplicationDto[]>(
    queryKeys.applications.list({ limit: 8 }),
    () => apiClient.get<ApplicationDto[]>("/api/applied"),
  );
  const rows = (recent.data ?? []).slice(0, 8);

  return (
    <SectionCard title="Recent activity" description="Most recent applications.">
      {rows.length === 0 ? (
        <Typography variant="body2Muted">
          No applications yet. Run a skill (e.g. <code>/jobpilot:apply</code>) to log one.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((app) => (
            <Stack
              key={app.id}
              direction="row"
              spacing={2}
              sx={(t) => ({
                alignItems: "center",
                p: 1.25,
                borderRadius: t.radii.sm,
                border: `1px solid ${t.palette.line.divider}`,
              })}
            >
              <StageChip stage={app.stage} />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/applications/${app.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {app.title}
                  </Typography>
                </Link>
                <Typography variant="captionMuted">
                  {app.company}
                  {app.board ? ` · ${app.board}` : ""}
                </Typography>
              </Stack>
              <Typography variant="captionMuted">
                {new Date(app.appliedAt).toLocaleDateString()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
