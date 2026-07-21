import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Cover letters" };

/** The list moved under /documents; detail routes stay here so saved links keep working. */
export default function CoverLettersPage(): never {
  redirect("/documents/cover-letters");
}
