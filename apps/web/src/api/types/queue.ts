import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A queue entry, inferred from `GET /api/queue`. */
export type QueueEntryDto = Data<typeof api.queue.get>[number];
