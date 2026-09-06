import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard, AuthFormSkeleton, LoginForm } from "@/components/features/auth";
import { resolveOauthReason } from "@/components/features/auth/oauth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your JobPilot dashboard to run and track job-application campaigns.",
  alternates: { canonical: "/login" },
};

interface LoginPageProps {
  searchParams: Promise<{ oauth?: string; reason?: string }>;
}

export default function LoginPage(props: LoginPageProps): ReactElement {
  const { searchParams } = props;
  return (
    <AuthCard title="Sign in" subtitle="Welcome back. Sign in to continue.">
      {/* The OAuth error rides on searchParams, so the card chrome ships without it. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginFormSection searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormSection(props: LoginPageProps): Promise<ReactElement> {
  const { oauth, reason } = await props.searchParams;
  const oauthError =
    oauth === "error" ? (resolveOauthReason(reason) ?? "Sign-in failed.") : undefined;
  return <LoginForm oauthError={oauthError} />;
}
