"use client";

import type { ReactElement } from "react";
import { ErrorFallback } from "@/components/ui/feedback";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardErrorBoundary(props: DashboardErrorProps): ReactElement {
  const { error, reset } = props;
  return <ErrorFallback error={error} reset={reset} />;
}
