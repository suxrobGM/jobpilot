import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

type AdminUserPageDto = Data<typeof api.admin.users.get>;

export type AdminUserDto = AdminUserPageDto["items"][number];

export type AdminBoardDto = Data<(typeof api.admin)["job-boards"]["get"]>["items"][number];

type AdminPilotPageDto = Data<typeof api.admin.pilots.get>;

export type AdminPilotDto = AdminPilotPageDto["items"][number];
