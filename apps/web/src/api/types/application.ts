import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** A submitted application row, inferred from `GET /api/applied`. */
export type ApplicationDto = Data<typeof api.applied.get>["items"][number];

/** A single application with its activity history, from `GET /api/applied/:id`. */
export type ApplicationDetailDto = Data<ReturnType<typeof api.applied>["get"]>;

/** One activity event on an application. */
export type ApplicationEventDto = ApplicationDetailDto["events"][number];
