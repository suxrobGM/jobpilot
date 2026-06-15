import type { ReactElement } from "react";
import { AuthCard, RegisterForm } from "@/components/features/auth";

export default function RegisterPage(): ReactElement {
  return (
    <AuthCard title="Create account" subtitle="Set up your local JobPilot account.">
      <RegisterForm />
    </AuthCard>
  );
}
