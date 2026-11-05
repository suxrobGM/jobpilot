import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, VerifyEmailView } from "@/components/features/auth";

export default function VerifyEmailPage(): ReactElement {
  return (
    <AuthCard title="Verify your email">
      <Suspense fallback={<AuthFormSkeleton />}>
        <VerifyEmailView />
      </Suspense>
    </AuthCard>
  );
}
