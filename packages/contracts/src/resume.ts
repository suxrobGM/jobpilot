import { z } from "zod/v4";
import { normalizeLinkUrl } from "./utils/url";
import { optionalPhoneSchema } from "./phone";

const linkUrl = z.string().transform(normalizeLinkUrl).optional();

export const resumeBasicsSchema = z.object({
  name: z.string().min(1, "Required"),
  headline: z.string().optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: optionalPhoneSchema,
  website: linkUrl,
  linkedin: linkUrl,
  github: linkUrl,
  location: z.string().optional(),
});

export const resumeExperienceSchema = z.object({
  id: z.string().optional(),
  company: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  location: z.string().optional(),
  start: z.string(),
  end: z.string().optional(),
  bullets: z.array(z.string()),
});

export const resumeProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Required"),
  url: linkUrl,
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

export const resumeSkillGroupSchema = z.object({
  group: z.string().min(1, "Required"),
  items: z.array(z.string()),
});

export const resumeEducationSchema = z.object({
  school: z.string().min(1, "Required"),
  degree: z.string().min(1, "Required"),
  start: z.string().optional(),
  end: z.string().optional(),
  details: z.array(z.string()).default([]),
});

export const resumeDataSchema = z.object({
  basics: resumeBasicsSchema,
  summary: z.string().optional(),
  experience: z.array(resumeExperienceSchema).default([]),
  projects: z.array(resumeProjectSchema).default([]),
  skills: z.array(resumeSkillGroupSchema).default([]),
  education: z.array(resumeEducationSchema).default([]),
});

export type ResumeData = z.infer<typeof resumeDataSchema>;
export type ResumeBasics = z.infer<typeof resumeBasicsSchema>;
export type ResumeExperience = z.infer<typeof resumeExperienceSchema>;
export type ResumeProject = z.infer<typeof resumeProjectSchema>;
export type ResumeSkillGroup = z.infer<typeof resumeSkillGroupSchema>;
export type ResumeEducation = z.infer<typeof resumeEducationSchema>;

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
};
