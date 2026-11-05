import type { ReactElement, ReactNode } from "react";
import { MarketingMain } from "@/components/layout";

interface JobsLayoutProps {
  children: ReactNode;
}

export default function JobsLayout(props: JobsLayoutProps): ReactElement {
  return <MarketingMain maxWidth="lg">{props.children}</MarketingMain>;
}
