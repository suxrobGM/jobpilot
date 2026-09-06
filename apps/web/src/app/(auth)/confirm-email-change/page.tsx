import { type ReactElement, Suspense } from "react";
import { Skeleton } from "@mui/material";
import { AuthCard, ConfirmEmailChangeView } from "@/components/features/auth";

interface ConfirmEmailChangePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default function ConfirmEmailChangePage(props: ConfirmEmailChangePageProps): ReactElement {
  return (
    // A status view, not a form: one bar stands in for the pending message.
    <AuthCard title="Confirm your new email">
      <Suspense fallback={<Skeleton variant="rounded" height={96} />}>
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
