"use client";

import { type ReactElement, useEffect, useRef } from "react";
import { Alert, Box, Button, CircularProgress, Link, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import type { ApiMutationResult } from "@/api/hooks";

interface MagicLinkViewProps {
  token?: string;
  /** Created by the caller; fired here exactly once with the token. */
  mutation: ApiMutationResult<unknown, { token: string }>;
  pendingText: string;
  successText: string;
  successLabel: string;
  successHref: Route;
  errorHint: string;
}

/** Shared consumer for magic-link pages (verify email, confirm email change). */
export function MagicLinkView(props: MagicLinkViewProps): ReactElement {
  const { token, mutation, pendingText, successText, successLabel, successHref, errorHint } = props;
  const fired = useRef(false);

  useEffect(() => {
    // Fire once - the token is single-use, so a strict-mode double-invoke would
    // make the second call fail against an already-consumed token.
    if (fired.current || !token) {
      return;
    }
    fired.current = true;
    mutation.mutate({ token });
  }, [token, mutation]);

  if (!token || mutation.isError) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="error">{mutation.error?.message ?? "Missing token."}</Alert>
        <Typography variant="body2Muted">{errorHint}</Typography>
        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          <Link href="/login" color="primary">
            Back to sign in
          </Link>
        </Typography>
      </Stack>
    );
  }

  if (mutation.isSuccess) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="success">{successText}</Alert>
        <Button href={successHref} variant="contained" size="large" fullWidth>
          {successLabel}
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 3, gap: 2 }}>
      <CircularProgress size={20} />
      <Typography variant="body2Muted">{pendingText}</Typography>
    </Box>
  );
}
