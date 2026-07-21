import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage(): never {
  redirect("/documents/resumes");
}
