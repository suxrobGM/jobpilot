import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

type AdminUserPageDto = Data<typeof api.admin.users.get>;

/** One row of the admin users table. */
export type AdminUserDto = AdminUserPageDto["items"][number];

/** A global catalog board with its adoption count, from `GET /api/admin/boards`. */
export type AdminBoardDto = Data<typeof api.admin.boards.get>["items"][number];

type AdminPilotPageDto = Data<typeof api.admin.pilots.get>;

/** One row of the admin Pilot fleet table. */
export type AdminPilotDto = AdminPilotPageDto["items"][number];
