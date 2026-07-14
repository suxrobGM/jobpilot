"use client";

import type { ReactElement } from "react";
import { ErrorFallback } from "@/components/ui/feedback";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootErrorBoundary(props: RootErrorProps): ReactElement {
  const { error, reset } = props;
  return <ErrorFallback error={error} reset={reset} />;
}
