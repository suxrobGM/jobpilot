import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Resumes" };

/** The list moved under /documents; detail routes stay here so plugin skill links keep working. */
export default function ResumesIndexPage(): never {
  redirect("/documents/resumes");
}
