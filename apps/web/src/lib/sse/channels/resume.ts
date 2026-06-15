import { defineChannel } from "../channel";

export type ResumeEvent = {
  type: "content.updated";
  resumeId: number;
  version: number;
};

/** Push updates when a resume's parsed content changes (e.g. after extraction). */
export const resumeChannel = defineChannel<ResumeEvent, { resumeId: number }>({
  name: "resume",
  url: ({ resumeId }) => `/api/resumes/${resumeId}/events`,
  topic: ({ resumeId }) => String(resumeId),
});
