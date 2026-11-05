import type { ReactElement } from "react";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/feedback";

export default function PortfolioNotFound(): ReactElement {
  return (
    <EmptyState
      title="Portfolio not found"
      description="No one here goes by that username. Explore who is trending instead."
      action={
        <LinkButton href="/leaderboard" variant="contained">
          View leaderboard
        </LinkButton>
      }
    />
  );
}
