import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PortfolioSettings } from "@/components/features/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default function DocumentsPortfolioPage(): ReactElement {
  return <PortfolioSettings />;
}
