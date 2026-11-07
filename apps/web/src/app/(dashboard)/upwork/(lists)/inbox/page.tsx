import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InboxList } from "@/components/features/upwork";

export const metadata: Metadata = { title: "Upwork inbox" };

export default function UpworkInboxPage(): ReactElement {
  return <InboxList />;
}
