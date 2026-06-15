export interface JobBoardDto {
  id: number;
  name: string;
  domain: string;
  searchUrl: string | null;
  email: string | null;
  password: string | null;
  sortOrder: number;
}
