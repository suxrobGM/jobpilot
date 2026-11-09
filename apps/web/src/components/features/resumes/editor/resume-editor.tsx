"use client";

import { type ReactElement, useEffect, useState } from "react";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { Add } from "@mui/icons-material";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { invalidations } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useConfirm } from "@/providers/confirm-provider";
import { AwardsSection } from "./awards-section";
import { BasicsSection } from "./basics-section";
import { CertificationsSection } from "./certifications-section";
import { CustomSectionsSection } from "./custom-sections-section";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { ProjectsSection } from "./projects-section";
import { PublicationsSection } from "./publications-section";
import { SaveBar } from "./save-bar";
import { SectionBlock } from "./section-block";
import { type EditorSection, RESUME_SECTIONS } from "./sections";
import { SkillsSection } from "./skills-section";
import { SummarySection } from "./summary-section";
import { useAutosave } from "./use-autosave";

interface ResumeEditorProps {
  resumeId: string;
  initialData: ResumeData;
  /** Server version of `initialData`; a newer one means someone else wrote to this resume. */
  version: number;
}

export function ResumeEditor(props: ResumeEditorProps): ReactElement {
  const { resumeId, initialData, version } = props;
  const confirm = useConfirm();
  const [data, setData] = useState<ResumeData>(initialData);
  const [openSection, setOpenSection] = useState<string | null>(RESUME_SECTIONS[0].id);
  // Optional sections added this session stay visible while still empty, so they can be filled.
  const [added, setAdded] = useState<string[]>([]);
  // The newest version this editor produced, so its own save echoing back is not a conflict.
  const [ownVersion, setOwnVersion] = useState(version);

  const save = useApiMutation(
    (vars: ResumeData) => api.resumes({ id: resumeId }).put({ content: vars }),
    {
      invalidate: invalidations.resume,
      onSuccess: (result) => setOwnVersion(result.version),
    },
  );

  const autosave = useAutosave<ResumeData>({ save: (value) => save.mutateAsync(value) });
  const dirty = autosave.state === "dirty" || autosave.state === "error";
  const conflicted = version > ownVersion;
  useUnsavedChangesGuard(dirty);

  // A newer version with nothing pending is safe to take: the agent finished a tailor or extract run.
  useEffect(() => {
    if (version > ownVersion && !dirty) {
      setData(initialData);
      setOwnVersion(version);
    }
  }, [version, ownVersion, dirty, initialData]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        autosave.flush();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [autosave.flush]);

  const patch = (next: Partial<ResumeData>): void => {
    const merged = { ...data, ...next };
    setData(merged);
    autosave.change(merged);
  };

  const reload = async (): Promise<void> => {
    const ok = await confirm({
      title: "Discard your edits?",
      description:
        "This resume changed elsewhere. Reloading replaces what you typed with the newer version.",
      confirmLabel: "Reload",
      destructive: true,
    });
    if (ok) {
      setData(initialData);
      setOwnVersion(version);
    }
  };

  const body: Record<string, ReactElement> = {
    basics: <BasicsSection value={data.basics} onChange={(v) => patch({ basics: v })} />,
    summary: <SummarySection value={data.summary ?? ""} onChange={(v) => patch({ summary: v })} />,
    experience: (
      <ExperienceSection value={data.experience} onChange={(v) => patch({ experience: v })} />
    ),
    projects: <ProjectsSection value={data.projects} onChange={(v) => patch({ projects: v })} />,
    skills: <SkillsSection value={data.skills} onChange={(v) => patch({ skills: v })} />,
    education: (
      <EducationSection value={data.education} onChange={(v) => patch({ education: v })} />
    ),
    publications: (
      <PublicationsSection value={data.publications} onChange={(v) => patch({ publications: v })} />
    ),
    awards: <AwardsSection value={data.awards} onChange={(v) => patch({ awards: v })} />,
    certifications: (
      <CertificationsSection
        value={data.certifications}
        onChange={(v) => patch({ certifications: v })}
      />
    ),
    sections: (
      <CustomSectionsSection value={data.sections} onChange={(v) => patch({ sections: v })} />
    ),
  };

  const hidden = (section: EditorSection): boolean =>
    Boolean(section.optional) && section.summary(data) === "empty" && !added.includes(section.id);
  const addable = RESUME_SECTIONS.filter(hidden);

  const addSection = (id: string): void => {
    setAdded([...added, id]);
    setOpenSection(id);
  };

  return (
    <Stack spacing={1.5}>
      {RESUME_SECTIONS.filter((section) => !hidden(section)).map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          summary={section.summary(data)}
          open={openSection === section.id}
          onToggle={(open) => setOpenSection(open ? section.id : null)}
        >
          {body[section.id]}
        </SectionBlock>
      ))}

      {addable.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, pt: 0.5 }}>
          <Typography variant="overlineMuted" sx={{ mr: 0.5 }}>
            Add
          </Typography>
          {addable.map((section) => (
            <Button
              key={section.id}
              size="small"
              variant="outlined"
              startIcon={<Add fontSize="sm" />}
              onClick={() => addSection(section.id)}
              sx={{ borderStyle: "dashed", bgcolor: "transparent" }}
            >
              {section.label}
            </Button>
          ))}
        </Stack>
      )}

      <SaveBar
        state={autosave.state}
        onSave={autosave.flush}
        conflict={
          conflicted && dirty ? (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={() => void reload()}>
                  Reload
                </Button>
              }
            >
              This resume changed elsewhere. Save to overwrite it, or reload to take the new
              version.
            </Alert>
          ) : null
        }
      />
    </Stack>
  );
}
