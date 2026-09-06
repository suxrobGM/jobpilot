import { type ReactElement, Suspense } from "react";
import { Skeleton } from "@mui/material";
import type { Metadata } from "next";
import {
  ChangeEmailCard,
  ChangePasswordCard,
  ConnectedAccountsCard,
} from "@/components/features/security";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = {
  title: "Account security",
  description: "Manage your sign-in email, password, and connected accounts.",
};

interface SecurityPageProps {
  searchParams: Promise<{ oauth?: string; provider?: string; reason?: string }>;
}

export default function SecurityPage(props: SecurityPageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Sign-in email, password, and connected accounts."
      />
      <ChangeEmailCard />
      <ChangePasswordCard />
      {/* Only this card reads the OAuth callback flags off the URL. */}
      <Suspense fallback={<Skeleton variant="rounded" height={220} />}>
        <ConnectedAccounts searchParams={props.searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ConnectedAccounts(props: SecurityPageProps): Promise<ReactElement> {
  const { oauth, provider, reason } = await props.searchParams;
  return <ConnectedAccountsCard oauthResult={oauth} provider={provider} reason={reason} />;
}
