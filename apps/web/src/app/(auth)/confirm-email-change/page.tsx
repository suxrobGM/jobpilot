import { type ReactElement, Suspense } from "react";
import { AuthCard, ConfirmEmailChangeView } from "@/components/features/auth";
import { DetailSkeleton } from "@/components/ui/feedback";

interface ConfirmEmailChangePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function ConfirmEmailChangePage(props: ConfirmEmailChangePageProps): ReactElement {
  return (
    // A status view, not a form: one bar stands in for the pending message.
    <AuthCard title="Confirm your new email">
      <Suspense fallback={<DetailSkeleton heights={[96]} />}>
        <ConfirmEmailChangeSection searchParams={props.searchParams} />
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
