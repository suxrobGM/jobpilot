import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProposalsList } from "@/components/features/upwork";

export const metadata: Metadata = { title: "Upwork" };

export default function UpworkPage(): ReactElement {
  return <ProposalsList />;
}
