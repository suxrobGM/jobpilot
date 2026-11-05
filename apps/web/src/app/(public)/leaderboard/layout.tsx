import type { ReactElement, ReactNode } from "react";
import { MarketingMain } from "@/components/layout";

interface LeaderboardLayoutProps {
  children: ReactNode;
}

export default function LeaderboardLayout(props: LeaderboardLayoutProps): ReactElement {
  return <MarketingMain maxWidth="md">{props.children}</MarketingMain>;
}
