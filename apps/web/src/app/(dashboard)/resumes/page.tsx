import { redirect } from "next/navigation";

/** The list moved under /documents; detail routes stay here so plugin skill links keep working. */
export default function ResumesIndexPage(): never {
  redirect("/documents/resumes");
}
