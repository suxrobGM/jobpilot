"use client";

import { type ReactElement, useState } from "react";
import { isProtectedVariantLabel, UNUSED_VARIANT_DAYS } from "@jobpilot/contracts/resume";
import { CleaningServices, Delete, OpenInNew } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { resumeQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { variantPdfUrl } from "@/api/resume-urls";
import type { ResumeVariantListItem } from "@/api/types";
import { QuerySection } from "@/components/ui/data";
import { RelativeTime } from "@/components/ui/display";
import { SearchField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { plural } from "@/utils/format";
import { TailorForJobButton } from "../tailor/tailor-for-job-button";
import { groupVariants } from "./group-variants";

interface VariantsPanelProps {
  resumeId: string;
  resumeLabel: string;
}

export function VariantsPanel(props: VariantsPanelProps): ReactElement {
  const { resumeId, resumeLabel } = props;
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  const query = useApiQuery(resumeQueries.variants(resumeId));

  const remove = useApiMutation((id: string) => api.resumes.variants({ id }).delete(), {
    successMessage: "Variant deleted",
    invalidate: [queryKeys.resume.variants(resumeId)],
  });

  const prune = useApiMutation(
    () => api.resumes({ id: resumeId }).variants.delete(undefined, { query: {} }),
    {
      successMessage: "Unused variants pruned",
      invalidate: [queryKeys.resume.variants(resumeId)],
    },
  );

  const handleDelete = async (variant: ResumeVariantListItem): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete variant?",
      description: `Remove "${variant.label}"? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate(variant.id);
    }
  };

  const variants = query.data ?? [];
  const prunable = variants.filter(
    (v) => v.applicationId === null && !isProtectedVariantLabel(v.label),
  );

  const handlePrune = async (): Promise<void> => {
    const confirmed = await confirm({
      title: `Prune ${prunable.length} unused variant${prunable.length === 1 ? "" : "s"}?`,
      description:
        "Deletes every variant not linked to an application. Variants you actually applied with are kept, as are pending suggestions. This cannot be undone.",
      confirmLabel: "Prune",
      destructive: true,
    });
    if (confirmed) {
      prune.mutate();
    }
  };
  const term = search.trim().toLowerCase();
  const filtered = term
    ? variants.filter(
        (v) =>
          v.label.toLowerCase().includes(term) || (v.jobUrl?.toLowerCase().includes(term) ?? false),
      )
    : variants;

  return (
    <SectionCard
      title="Tailored variants"
      description={`AI-generated copies of "${resumeLabel}" tailored to specific jobs. Bases are not modified, and unused variants are removed automatically after ${UNUSED_VARIANT_DAYS} days.`}
      actions={
        <Stack direction="row" spacing={1}>
          {prunable.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<CleaningServices />}
              disabled={prune.isPending}
              onClick={() => void handlePrune()}
            >
              Prune {prunable.length} unused
            </Button>
          )}
          <TailorForJobButton />
        </Stack>
      }
    >
      <QuerySection
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle="Couldn't load the variants."
        isEmpty={variants.length === 0}
        empty={
          <Typography variant="body2Muted">
            No variants yet. Click &ldquo;Tailor for job&rdquo;, paste a job description or URL, and
            the AI will either reuse a close match (if you had previous variants) or create a new
            one.
          </Typography>
        }
      >
        <Stack spacing={1.5}>
          <SearchField
            placeholder="Search by label or job URL"
            value={search}
            onChange={setSearch}
          />
          {filtered.length === 0 ? (
            <Typography variant="body2Muted">No variants match &ldquo;{search}&rdquo;.</Typography>
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 480, overflowY: "auto", pr: 0.5 }}>
              {groupVariants(filtered).map((group) => (
                <Stack key={group.company} spacing={1} sx={{ flexShrink: 0 }}>
                  <Typography variant="overlineMuted">
                    {group.company} · {plural(group.variants.length, "variant")}
                    {group.attached > 0 && ` · ${group.attached} applied with`}
                  </Typography>
                  {group.variants.map((v) => (
                    <Card key={v.id} sx={{ flexShrink: 0 }}>
                      <CardContent>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Typography variant="body2Strong">{v.label}</Typography>
                              <Chip
                                label={v.applicationId ? "Applied with this" : "Unused"}
                                variant="outlined"
                                color={v.applicationId ? "success" : "default"}
                              />
                            </Stack>
                            <Typography variant="captionMuted">
                              {v.jobUrl ? `${v.jobUrl} · ` : ""}created{" "}
                              <RelativeTime value={v.createdAt} />
                            </Typography>
                          </Box>
                          <IconButton
                            href={variantPdfUrl(v.id, v.updatedAt)}
                            aria-label="Open variant PDF"
                          >
                            <OpenInNew fontSize="md" />
                          </IconButton>
                          <IconButton
                            onClick={() => void handleDelete(v)}
                            aria-label="Delete variant"
                          >
                            <Delete fontSize="md" />
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </QuerySection>
    </SectionCard>
  );
}
