"use client";

import type { ReactElement } from "react";
import type { OAuthProviderInput } from "@jobpilot/contracts/auth";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { authQueries } from "@/api/queries";
import { OAUTH_PROVIDERS, oauthStartUrl, resolveOauthReason } from "@/components/features/auth";
import { TooltipButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useSession } from "@/hooks/use-auth";
import { useConfirm } from "@/providers/confirm-provider";

export function ConnectedAccountsCard(): ReactElement {
  // Flags the OAuth callback redirect appends: `oauth` is "linked" or "error".
  const params = useSearchParams();
  const oauthResult = params.get("oauth") ?? undefined;
  const provider = params.get("provider") ?? undefined;
  const reason = params.get("reason") ?? undefined;
  const { user } = useSession();
  const confirm = useConfirm();

  const linked = user?.providers ?? [];
  const hasPassword = user?.hasPassword ?? true;
  const lastMethod = !hasPassword && linked.length === 1;

  const unlink = useApiMutation(
    (p: OAuthProviderInput) => api.auth.providers({ provider: p }).delete(),
    { successMessage: "Account unlinked", invalidate: [authQueries.me().queryKey] },
  );

  const link = (p: OAuthProviderInput): void => {
    window.location.href = oauthStartUrl(p, "link");
  };

  const handleUnlink = async (p: OAuthProviderInput, label: string): Promise<void> => {
    const confirmed = await confirm({
      title: `Unlink ${label}?`,
      description: `You'll no longer be able to sign in with ${label}.`,
      confirmLabel: "Unlink",
      destructive: true,
    });
    if (confirmed) {
      unlink.mutate(p);
    }
  };

  return (
    <SectionCard
      title="Connected accounts"
      description="Sign in with these providers alongside your email and password."
    >
      <Stack spacing={2}>
        {oauthResult === "linked" && (
          <Alert severity="success">
            {OAUTH_PROVIDERS.find((p) => p.id === provider)?.label ?? "Account"} linked.
          </Alert>
        )}
        {oauthResult === "error" && reason && (
          <Alert severity="error">{resolveOauthReason(reason)}</Alert>
        )}

        {OAUTH_PROVIDERS.map(({ id, label }) => {
          const isLinked = linked.includes(id);
          return (
            <Stack
              key={id}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="body2Strong">{label}</Typography>
                <Typography variant="captionMuted">
                  {isLinked ? "Connected" : "Not connected"}
                </Typography>
              </Box>
              {isLinked ? (
                <TooltipButton
                  title={
                    lastMethod ? "This is your only sign-in method - set a password first" : ""
                  }
                  variant="outlined"
                  color="error"
                  disabled={lastMethod || unlink.isPending}
                  onClick={() => void handleUnlink(id, label)}
                >
                  Unlink
                </TooltipButton>
              ) : (
                <Button variant="outlined" onClick={() => link(id)}>
                  Link
                </Button>
              )}
            </Stack>
          );
        })}
      </Stack>
    </SectionCard>
  );
}
