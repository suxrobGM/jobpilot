import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type ApplicationDto = Data<typeof api.applications.get>["items"][number];

export type ApplicationDetailDto = Data<ReturnType<typeof api.applications>["get"]>;

export type ApplicationEventDto = ApplicationDetailDto["events"][number];
