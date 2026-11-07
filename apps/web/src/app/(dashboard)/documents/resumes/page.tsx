import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ResumesList } from "@/components/features/resumes";

export const metadata: Metadata = { title: "Resumes" };

export default function DocumentsResumesPage(): ReactElement {
  return <ResumesList />;
}
