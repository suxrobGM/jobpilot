"use client";

import { type ReactNode, useState } from "react";
import { EMPTY_RESUME_DATA, SUGGESTED_REWRITE_LABEL } from "@jobpilot/contracts/resume";
import { AutoFixHigh } from "@mui/icons-material";
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invalidations, resumeQueries } from "@/api/queries";
import type { ResumeDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";
import { plural } from "@/utils/format";
import { diffRewrite } from "./rewrite-diff";
import { RewriteReviewDialog } from "./rewrite-review-dialog";

interface SuggestedRewriteCardProps {
  resume: ResumeDto;
}

/** Accept overwrites the base with `review-resume`'s suggestion; the uploaded PDF stays the way back. */
export function SuggestedRewriteCard(props: SuggestedRewriteCardProps): ReactNode {
  const { resume } = props;
  const resumeId = resume.id;
  const confirm = useConfirm();
  const [reviewing, setReviewing] = useState(false);

  const variants = useQuery(resumeQueries.variants(resumeId));
  const suggestion = variants.data?.find((v) => v.label === SUGGESTED_REWRITE_LABEL);

  // Only the list is cached up front; the body arrives with the detail fetch.
  const detail = useQuery({
    ...resumeQueries.variantDetail(suggestion?.id ?? ""),
    enabled: suggestion !== undefined,
  });

  const discard = useApiMutation((id: string) => api.resumes.variants({ id }).delete(), {
    successMessage: "Suggestion discarded",
    invalidate: [resumeQueries.variants(resumeId).queryKey],
  });

  // One call: the API writes the content onto the base and drops the suggestion in one transaction.
  const accept = useApiMutation(
    (variantId: string) => api.resumes.variants({ id: variantId }).apply.post(),
    {
      successMessage: "Resume updated",
      invalidate: [resumeQueries.variants(resumeId).queryKey, ...invalidations.resume],
    },
  );

  if (!suggestion) {
    return null;
  }

  if (detail.isLoading) {
    return <DetailSkeleton heights={[120]} />;
  }
  if (!detail.data) {
    return (
      <QueryError
        title="Couldn't load the suggested rewrite."
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const changeCount = diffRewrite(resume.content ?? EMPTY_RESUME_DATA, detail.data.content).length;

  const handleDiscard = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Discard the suggestion?",
      description: "Your resume stays as it is.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (confirmed) {
      discard.mutate(suggestion.id);
    }
  };

  const isLoading = accept.isPending || discard.isPending;

  return (
    <>
      <Alert severity="info" variant="outlined" icon={<AutoFixHigh fontSize="md" />}>
        <AlertTitle>
          {changeCount > 0 ? plural(changeCount, "suggested change") : "A rewrite is ready"}
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Review them side by side before anything replaces your text.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            disabled={isLoading}
            onClick={() => setReviewing(true)}
          >
            Review
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            disabled={isLoading}
            onClick={() => void handleDiscard()}
          >
            Discard
          </Button>
        </Stack>
      </Alert>

      <RewriteReviewDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        resume={resume}
        suggestion={detail.data}
        isLoading={isLoading}
        onApply={() => accept.mutate(suggestion.id)}
      />
    </>
  );
}
