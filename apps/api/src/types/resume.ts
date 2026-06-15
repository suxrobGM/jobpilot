import type { ResumeData } from "@jobpilot/contracts/resume";
import type { VariantRewriteAudit } from "@/modules/resumes/rewrite";

export interface ResumeDto {
  id: number;
  profileId: number;
  label: string;
  content: ResumeData | null;
  version: number;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  sourceSizeBytes: number | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeListItem {
  id: number;
  label: string;
  sourceFilename: string | null;
  hasData: boolean;
  variantCount: number;
  isPrimary: boolean;
  updatedAt: string;
}

export interface ResumeVariantDto {
  id: number;
  resumeId: number;
  resumeLabel: string;
  label: string;
  jobUrl: string | null;
  applicationId: number | null;
  content: ResumeData;
  diffNotes: string | null;
  /** Per-bullet rewrite audit, or null when the variant used reordering only. */
  rewrites: VariantRewriteAudit | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVariantListItem {
  id: number;
  resumeId: number;
  label: string;
  jobUrl: string | null;
  applicationId: number | null;
  createdAt: string;
  updatedAt: string;
}
