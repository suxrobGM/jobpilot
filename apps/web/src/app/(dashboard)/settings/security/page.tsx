import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import {
  ChangeEmailCard,
  ChangePasswordCard,
  ConnectedAccountsCard,
} from "@/components/features/settings";
import { DetailSkeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Security",
  description: "Manage your sign-in email, password, and connected accounts.",
};

export default function SecuritySettingsPage(): ReactElement {
  return (
    <>
      <ChangeEmailCard />
      <ChangePasswordCard />
      {/* It reads the OAuth callback flags off the URL. */}
      <Suspense fallback={<DetailSkeleton heights={[220]} />}>
        <ConnectedAccountsCard />
      </Suspense>
    </>
  );
}
