export type JobBoardType = "search" | "ats";

export interface JobBoardDto {
  id: number;
  name: string;
  domain: string;
  searchUrl: string | null;
  type: JobBoardType;
  enabled: boolean;
  email: string | null;
  password: string | null;
  sortOrder: number;
}
