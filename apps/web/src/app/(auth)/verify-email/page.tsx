import type { ReactElement } from "react";
import { AuthCard, VerifyEmailView } from "@/components/features/auth";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage(props: VerifyEmailPageProps): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return (
    <AuthCard
      title="Verify your email"
      subtitle={token ? undefined : "Confirm your email to start using JobPilot."}
    >
      <VerifyEmailView token={token} />
    </AuthCard>
  );
}
