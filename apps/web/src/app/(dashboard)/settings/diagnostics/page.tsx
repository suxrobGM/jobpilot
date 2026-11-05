import type { ReactElement } from "react";
import type { Metadata } from "next";
import { DiagnosticsView } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Diagnostics" };

export default function DiagnosticsPage(): ReactElement {
  return <DiagnosticsView />;
}
