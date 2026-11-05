import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, ResetPasswordForm } from "@/components/features/auth";

export default function ResetPasswordPage(): ReactElement {
  return (
    <AuthCard title="Reset password" subtitle="Choose a new password for your account.">
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
