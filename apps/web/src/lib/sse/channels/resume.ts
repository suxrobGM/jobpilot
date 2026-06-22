import { API_BASE_URL } from "@/api/base-url";
import { defineChannel } from "../channel";

export type ResumeEvent =
  | { type: "content.updated"; resumeId: string; version: number }
  | { type: "variant.created"; resumeId: string; variantId: string };

/** Push updates when a resume's content changes (extraction) or a tailored variant is added. */
export const resumeChannel = defineChannel<ResumeEvent, { resumeId: string }>({
  name: "resume",
  url: ({ resumeId }) => `${API_BASE_URL}/api/resumes/${resumeId}/events`,
  topic: ({ resumeId }) => String(resumeId),
});
