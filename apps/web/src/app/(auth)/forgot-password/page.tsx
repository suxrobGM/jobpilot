import type { ReactElement } from "react";
import { AuthCard, ForgotPasswordForm } from "@/components/features/auth";

export default function ForgotPasswordPage(): ReactElement {
  return (
    <AuthCard title="Forgot password" subtitle="Enter your email and we'll send a reset link.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
