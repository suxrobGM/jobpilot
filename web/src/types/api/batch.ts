import type { BatchStatus } from "@/lib/schemas/batch";

export interface BatchInputDto {
  id: number;
  url: string;
  note: string | null;
  status: BatchStatus;
  createdAt: string;
  consumedAt: string | null;
}
