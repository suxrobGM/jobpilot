import { redirect } from "next/navigation";

/** The list moved under /documents; detail routes stay here so saved links keep working. */
export default function CoverLettersPage(): never {
  redirect("/documents/cover-letters");
}
