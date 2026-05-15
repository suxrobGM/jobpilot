"use client";

import { useState, type ReactElement } from "react";
import { Save } from "@mui/icons-material";
import { Box, Button, Stack } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import { SectionAnchorNav, type SectionAnchor } from "@/components/ui/layout/section-anchor-nav";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ResumeData } from "@/lib/schemas/resume";
import { BasicsSection } from "./editor/basics-section";
import { EducationSection } from "./editor/education-section";
import { ExperienceSection } from "./editor/experience-section";
import { ProjectsSection } from "./editor/projects-section";
import { SkillsSection } from "./editor/skills-section";
import { SummarySection } from "./editor/summary-section";

interface ResumeEditorProps {
  resumeId: number;
  initialData: ResumeData;
}

const ANCHORS: SectionAnchor[] = [
  { id: "basics", label: "Basics" },
  { id: "summary", label: "Summary" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "education", label: "Education" },
];

export function ResumeEditor(props: ResumeEditorProps): ReactElement {
  const { resumeId, initialData } = props;
  const [data, setData] = useState<ResumeData>(initialData);
  const [dirty, setDirty] = useState(false);

  const save = useApiMutation<{ id: number; version: number }, ResumeData>(
    (vars) => apiClient.put<{ id: number; version: number }>(`/api/resumes/${resumeId}`, { data: vars }),
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
          {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
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
            <Box data-section-id="basics">
              <BasicsSection value={data.basics} onChange={(v) => patch({ basics: v })} />
            </Box>
            <Box data-section-id="summary">
              <SummarySection
                value={data.summary ?? ""}
                onChange={(v) => patch({ summary: v })}
              />
            </Box>
            <Box data-section-id="experience">
              <ExperienceSection
                value={data.experience}
                onChange={(v) => patch({ experience: v })}
              />
            </Box>
            <Box data-section-id="projects">
              <ProjectsSection value={data.projects} onChange={(v) => patch({ projects: v })} />
            </Box>
            <Box data-section-id="skills">
              <SkillsSection value={data.skills} onChange={(v) => patch({ skills: v })} />
            </Box>
            <Box data-section-id="education">
              <EducationSection
                value={data.education}
                onChange={(v) => patch({ education: v })}
              />
            </Box>
          </Stack>
        </Box>
      </Box>
    </SectionCard>
  );
}
