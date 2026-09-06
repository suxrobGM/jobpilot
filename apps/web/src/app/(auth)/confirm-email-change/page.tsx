import { type ReactElement, Suspense } from "react";
import { AuthCard, AuthFormSkeleton, ConfirmEmailChangeView } from "@/components/features/auth";

interface ConfirmEmailChangePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function ConfirmEmailChangePage(props: ConfirmEmailChangePageProps): ReactElement {
  const { searchParams } = props;
  return (
    <AuthCard title="Confirm your new email">
      <Suspense fallback={<AuthFormSkeleton fields={0} />}>
        <ConfirmEmailChangeSection searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ConfirmEmailChangeSection(
  props: ConfirmEmailChangePageProps,
): Promise<ReactElement> {
  const { token } = await props.searchParams;
  return <ConfirmEmailChangeView token={token} />;
}
