"use client";

import type { ReactElement } from "react";
import { useEffect } from "react";
import { Button, Container } from "@mui/material";
import { EmptyState } from "@/components/ui/data";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** The default export of both `app/error.tsx` files; knip cannot see through their re-export. @knipignore */
export function ErrorFallback(props: ErrorFallbackProps): ReactElement {
  const { error, reset } = props;

  // Surfaces the server-assigned digest so the failure is greppable in logs.
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <EmptyState
        title="Something went wrong"
        description="An unexpected error occurred. Try again, and if it keeps happening, let us know."
        action={
          <Button variant="contained" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Container>
  );
}
