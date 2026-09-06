import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, ResetPasswordForm } from "@/components/features/auth";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function ResetPasswordPage(props: PageProps): ReactElement {
  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetPasswordSection searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetPasswordSection(props: PageProps): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
