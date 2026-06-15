import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A submitted application row, inferred from `GET /api/applied`. */
export type ApplicationDto = Data<typeof api.applied.get>[number];

/** A single application with its stage history, from `GET /api/applied/:id`. */
export type ApplicationDetailDto = Data<ReturnType<typeof api.applied>["get"]>;

/** One stage-transition event on an application. */
export type StageEventDto = ApplicationDetailDto["stageEvents"][number];

/** Result of the dedupe check, from `GET /api/applied/check`. */
export type DuplicateCheckResult = Data<typeof api.applied.check.get>;
