import type { PushPayload, PushService } from "./push.service";

export type SentPush = { userId: string; payload: PushPayload };

/** Fake PushService recording sendToUser calls without any web-push/env dependency. */
export function makePush(pushes: SentPush[]): PushService {
  return {
    sendToUser: async (userId: string, payload: PushPayload) => {
      pushes.push({ userId, payload });
    },
  } as unknown as PushService;
}
