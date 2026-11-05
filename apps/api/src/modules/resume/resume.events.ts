import { type ResumeEvent, resumeChannel, workspaceChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";

/** Detail views follow the resume's own channel; the list follows the user's workspace feed. */
export function publishResumeEvent(userId: string, event: ResumeEvent): void {
  publish(resumeChannel, { resumeId: event.resumeId }, event);
  publish(workspaceChannel, { userId }, { type: "resume.updated", resumeId: event.resumeId });
}
