import type { ReactElement, ReactNode } from "react";
import { MarketingFrame } from "@/components/layout";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout(props: PublicLayoutProps): ReactElement {
  return <MarketingFrame>{props.children}</MarketingFrame>;
}
