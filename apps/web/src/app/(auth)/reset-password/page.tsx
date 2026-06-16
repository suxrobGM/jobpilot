import type { ReactElement } from "react";
import { AuthCard, ResetPasswordForm } from "@/components/features/auth";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage(props: PageProps): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <ResetPasswordForm token={token ?? ""} />
    </AuthCard>
  );
}
