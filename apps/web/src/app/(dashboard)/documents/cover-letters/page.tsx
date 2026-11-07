import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CoverLettersList } from "@/components/features/cover-letters";

export const metadata: Metadata = { title: "Cover letters" };

export default function DocumentsCoverLettersPage(): ReactElement {
  return <CoverLettersList />;
}
