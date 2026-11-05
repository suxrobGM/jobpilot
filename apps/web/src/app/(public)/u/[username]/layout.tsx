import type { ReactElement, ReactNode } from "react";
import { MarketingMain } from "@/components/layout";

interface PortfolioLayoutProps {
  children: ReactNode;
}

export default function PortfolioLayout(props: PortfolioLayoutProps): ReactElement {
  return <MarketingMain maxWidth="md">{props.children}</MarketingMain>;
}
