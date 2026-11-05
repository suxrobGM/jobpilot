import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** A submitted application row, inferred from `GET /api/applications`. */
export type ApplicationDto = Data<typeof api.applications.get>["items"][number];

/** A single application with its activity history, from `GET /api/applications/:id`. */
export type ApplicationDetailDto = Data<ReturnType<typeof api.applications>["get"]>;

/** One activity event on an application. */
export type ApplicationEventDto = ApplicationDetailDto["events"][number];
