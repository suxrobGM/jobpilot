import type { CoverLetterSource } from "@jobpilot/contracts/cover-letter";

export interface CoverLetterListItem {
  id: number;
  jobTitle: string | null;
  company: string | null;
  jobUrl: string | null;
  source: CoverLetterSource;
  createdAt: string;
}

export interface CoverLetterDto extends CoverLetterListItem {
  profileId: number;
  content: string;
}
