import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, VerifyEmailView } from "@/components/features/auth";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function VerifyEmailPage(props: VerifyEmailPageProps): ReactElement {
  const { searchParams } = props;
  return (
    <AuthCard
      title="Verify your email"
      subtitle={
        <Suspense fallback={null}>
          <VerifyEmailSubtitle searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <VerifyEmailSection searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

/** Only the no-token gate explains itself; arriving from a magic link needs no preamble. */
async function VerifyEmailSubtitle(props: VerifyEmailPageProps): Promise<ReactElement | null> {
  const { token } = await props.searchParams;
  return token ? null : <>Confirm your email to start using JobPilot.</>;
}

async function VerifyEmailSection(props: VerifyEmailPageProps): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return <VerifyEmailView token={token} />;
}
