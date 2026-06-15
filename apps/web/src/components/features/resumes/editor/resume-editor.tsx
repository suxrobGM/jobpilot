"use client";

import { useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import {
  AccountCircleOutlined,
  Build,
  DescriptionOutlined,
  Save,
  SchoolOutlined,
  StarOutlined,
  WorkOutlined,
} from "@mui/icons-material";
import { Box, Button, Stack, Typography, type SvgIconProps } from "@mui/material";
import { unwrap } from "@/api/client";
import { api } from "@/api/eden";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { SectionCard } from "@/components/ui/layout";
import { SectionAnchorNav, type SectionAnchor } from "@/components/ui/layout/section-anchor-nav";
import { BasicsSection } from "./basics-section";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { ProjectsSection } from "./projects-section";
import { SkillsSection } from "./skills-section";
import { SummarySection } from "./summary-section";

interface ResumeEditorProps {
  resumeId: number;
  initialData: ResumeData;
}

interface EditorSection {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<SvgIconProps>;
}

const SECTIONS: EditorSection[] = [
  {
    id: "basics",
    label: "Basics",
    description: "Name, contact info, and links.",
    icon: AccountCircleOutlined,
  },
  {
    id: "summary",
    label: "Summary",
    description: "Short professional summary at the top of the resume.",
    icon: DescriptionOutlined,
  },
  {
    id: "experience",
    label: "Experience",
    description: "Work history with role bullets.",
    icon: WorkOutlined,
  },
  {
    id: "projects",
    label: "Projects",
    description: "Notable side, open-source, or freelance projects.",
    icon: Build,
  },
  {
    id: "skills",
    label: "Skills",
    description: "Grouped skill keywords.",
    icon: StarOutlined,
  },
  {
    id: "education",
    label: "Education",
    description: "Degrees, schools, and details.",
    icon: SchoolOutlined,
  },
];

const ANCHORS: SectionAnchor[] = SECTIONS.map((s) => ({ id: s.id, label: s.label }));

interface SectionBlockProps {
  section: EditorSection;
  children: ReactNode;
}

function SectionBlock(props: SectionBlockProps): ReactElement {
  const { section, children } = props;
  const Icon = section.icon;
  return (
    <Box data-section-id={section.id}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={(t) => ({
          alignItems: "flex-start",
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: t.palette.surfaces.card,
          py: 1.5,
          mb: 2,
          borderBottom: `1px solid ${t.palette.line.divider}`,
        })}
      >
        <Icon fontSize="small" sx={{ mt: "2px", color: "text.secondary" }} />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="h4">{section.label}</Typography>
          <Typography variant="captionMuted">{section.description}</Typography>
        </Stack>
      </Stack>
      {children}
    </Box>
  );
}

export function ResumeEditor(props: ResumeEditorProps): ReactElement {
  const { resumeId, initialData } = props;
  const [data, setData] = useState<ResumeData>(initialData);
  const [dirty, setDirty] = useState(false);

  const save = useApiMutation<{ id: number; version: number }, ResumeData>(
    (vars) => unwrap(api.resumes({ id: resumeId }).put({ content: vars })),
    {
      successMessage: "Resume saved",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
      onSuccess: () => setDirty(false),
    },
  );

  const patch = (next: Partial<ResumeData>): void => {
    setData((prev) => ({ ...prev, ...next }));
    setDirty(true);
  };

  return (
    <SectionCard
      title="Structured resume"
      description="Edit fields here; the PDF preview re-renders after saving."
      actions={
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => save.mutate(data)}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? "Saving" : dirty ? "Save" : "Saved"}
        </Button>
      }
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: 3,
          alignItems: "flex-start",
        }}
      >
        <SectionAnchorNav anchors={ANCHORS} />

        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Stack spacing={4}>
            <SectionBlock section={SECTIONS[0]}>
              <BasicsSection value={data.basics} onChange={(v) => patch({ basics: v })} />
            </SectionBlock>
            <SectionBlock section={SECTIONS[1]}>
              <SummarySection value={data.summary ?? ""} onChange={(v) => patch({ summary: v })} />
            </SectionBlock>
            <SectionBlock section={SECTIONS[2]}>
              <ExperienceSection
                value={data.experience}
                onChange={(v) => patch({ experience: v })}
              />
            </SectionBlock>
            <SectionBlock section={SECTIONS[3]}>
              <ProjectsSection value={data.projects} onChange={(v) => patch({ projects: v })} />
            </SectionBlock>
            <SectionBlock section={SECTIONS[4]}>
              <SkillsSection value={data.skills} onChange={(v) => patch({ skills: v })} />
            </SectionBlock>
            <SectionBlock section={SECTIONS[5]}>
              <EducationSection value={data.education} onChange={(v) => patch({ education: v })} />
            </SectionBlock>
          </Stack>
        </Box>
      </Box>
    </SectionCard>
  );
}
