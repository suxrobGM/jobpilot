import { z } from "zod/v4";
import { optionalPhoneSchema } from "./phone";
import { normalizeLinkUrl } from "./utils/url";

const linkUrl = z.string().transform(normalizeLinkUrl).optional();

const resumeBasicsSchema = z.object({
  name: z.string().min(1, "Required"),
  headline: z.string().optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: optionalPhoneSchema,
  website: linkUrl,
  linkedin: linkUrl,
  github: linkUrl,
  location: z.string().optional(),
});

const resumeExperienceSchema = z.object({
  id: z.string().optional(),
  company: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  location: z.string().optional(),
  start: z.string(),
  end: z.string().optional(),
  bullets: z.array(z.string()),
});

const resumeProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Required"),
  url: linkUrl,
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  // Free-text like the experience dates ("Jan 2025", "2024", "Present"). Optional because most
  // resumes list projects undated - but a project can only be promoted onto the experience
  // timeline if it has a real range, so filling these in is what unlocks that.
  start: z.string().optional(),
  end: z.string().optional(),
});

const resumeSkillGroupSchema = z.object({
  id: z.string().optional(),
  group: z.string().min(1, "Required"),
  items: z.array(z.string()),
});

const resumeEducationSchema = z.object({
  id: z.string().optional(),
  school: z.string().min(1, "Required"),
  degree: z.string().min(1, "Required"),
  start: z.string().optional(),
  end: z.string().optional(),
  details: z.array(z.string()).default([]),
});

const resumePublicationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Required"),
  // Verbatim from the CV, so an existing citation's author order and et al. survive a round trip.
  authors: z.string().optional(),
  venue: z.string().optional(),
  // Free text like every other date on a resume ("2024", "In press", "Under review").
  year: z.string().optional(),
  url: linkUrl,
  doi: z.string().optional(),
});

const resumeAwardSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Required"),
  issuer: z.string().optional(),
  year: z.string().optional(),
  description: z.string().optional(),
});

const resumeCertificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Required"),
  issuer: z.string().optional(),
  issued: z.string().optional(),
  expires: z.string().optional(),
  credentialId: z.string().optional(),
  url: linkUrl,
});

const resumeCustomEntrySchema = z.object({
  id: z.string().optional(),
  heading: z.string().min(1, "Required"),
  subheading: z.string().optional(),
  meta: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

/**
 * The catch-all. Academic CVs carry sections nothing here anticipates - grants, talks, patents,
 * teaching, service, memberships - and a plain `z.object` strips an unknown key silently, so
 * without somewhere to put them the import loses that content with a 200 and no warning.
 */
const resumeCustomSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Required"),
  entries: z.array(resumeCustomEntrySchema).default([]),
});

export const resumeDataSchema = z.object({
  basics: resumeBasicsSchema,
  summary: z.string().optional(),
  experience: z.array(resumeExperienceSchema).default([]),
  projects: z.array(resumeProjectSchema).default([]),
  skills: z.array(resumeSkillGroupSchema).default([]),
  education: z.array(resumeEducationSchema).default([]),
  publications: z.array(resumePublicationSchema).default([]),
  awards: z.array(resumeAwardSchema).default([]),
  certifications: z.array(resumeCertificationSchema).default([]),
  sections: z.array(resumeCustomSectionSchema).default([]),
});

export type ResumeData = z.infer<typeof resumeDataSchema>;
export type ResumeBasics = z.infer<typeof resumeBasicsSchema>;
export type ResumeExperience = z.infer<typeof resumeExperienceSchema>;
export type ResumeProject = z.infer<typeof resumeProjectSchema>;
export type ResumeSkillGroup = z.infer<typeof resumeSkillGroupSchema>;
export type ResumeEducation = z.infer<typeof resumeEducationSchema>;
export type ResumePublication = z.infer<typeof resumePublicationSchema>;
export type ResumeAward = z.infer<typeof resumeAwardSchema>;
export type ResumeCertification = z.infer<typeof resumeCertificationSchema>;
export type ResumeCustomSection = z.infer<typeof resumeCustomSectionSchema>;
export type ResumeCustomEntry = z.infer<typeof resumeCustomEntrySchema>;

export const resumeVariantCreateSchema = z.object({
  label: z.string().min(1, "Required"),
  jobUrl: z.string().optional().nullable(),
  applicationId: z.uuid().optional().nullable(),
  content: resumeDataSchema,
  diffNotes: z.string().optional().nullable(),
});

export const resumeVariantPatchSchema = z.object({
  label: z.string().min(1).optional(),
  jobUrl: z.string().optional().nullable(),
  applicationId: z.uuid().optional().nullable(),
  content: resumeDataSchema.optional(),
  diffNotes: z.string().optional().nullable(),
});

export const EMPTY_RESUME_DATA: ResumeData = {
  basics: { name: "" },
  summary: "",
  experience: [],
  projects: [],
  skills: [],
  education: [],
  publications: [],
  awards: [],
  certifications: [],
  sections: [],
};

/**
 * Characters per rendered bullet line: ~498pt of usable width, Helvetica 9.5pt at ~4.75pt a
 * character. Keep in step with `bulletList`/`bulletText` in `common/pdf/jake-template.tsx`.
 */
export const RESUME_BULLET_CHARS_PER_LINE = 104;

/** An agent-authored rewrite awaiting the user's accept or discard. */
export const SUGGESTED_REWRITE_LABEL = "Suggested rewrite";

/** How long an unused variant survives the sweep. Shared so the panel and the cron agree. */
export const UNUSED_VARIANT_DAYS = 30;

export const PROTECTED_VARIANT_LABELS = [SUGGESTED_REWRITE_LABEL] as const;

/** Whether a variant label is reserved, and so exempt from pruning and reuse scoring. */
export function isProtectedVariantLabel(label: string): boolean {
  return PROTECTED_VARIANT_LABELS.some((reserved) => label.startsWith(reserved));
}
