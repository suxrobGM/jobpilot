import type { ReactElement } from "react";
import type { Metadata } from "next";
import { AuthCard, LoginForm } from "@/components/features/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your JobPilot dashboard to run and track job-application campaigns.",
  alternates: { canonical: "/login" },
};

export default function LoginPage(): ReactElement {
  // The form reads its own OAuth error off the URL, so the whole page prerenders.
  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Sign in to continue.">
      <LoginForm />
    </AuthCard>
  );
}
