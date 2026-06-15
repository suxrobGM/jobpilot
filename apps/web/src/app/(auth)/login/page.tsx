import type { ReactElement } from "react";
import { AuthCard, LoginForm } from "@/components/features/auth";

export default function LoginPage(): ReactElement {
  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Sign in to continue.">
      <LoginForm />
    </AuthCard>
  );
}
