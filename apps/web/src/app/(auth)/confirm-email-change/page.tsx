import { type ReactElement, Suspense } from "react";
import { AuthCard, ConfirmEmailChangeView } from "@/components/features/auth";
import { DetailSkeleton } from "@/components/ui/feedback";

export default function ConfirmEmailChangePage(): ReactElement {
  return (
    // A status view, not a form: one bar stands in for the pending message.
    <AuthCard title="Confirm your new email">
      <Suspense fallback={<DetailSkeleton heights={[96]} />}>
        <ConfirmEmailChangeView />
      </Suspense>
    </AuthCard>
  );
}
