import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, VerifyEmailView } from "@/components/features/auth";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function VerifyEmailPage(props: VerifyEmailPageProps): ReactElement {
  return (
    <AuthCard title="Verify your email">
      <Suspense fallback={<AuthFormSkeleton />}>
        <VerifyEmailSection searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function VerifyEmailSection(props: VerifyEmailPageProps): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return <VerifyEmailView token={token} />;
}
