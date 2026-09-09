import { EMPTY_RESUME_DATA, type ResumeData } from "@jobpilot/contracts/resume";

export const NLP_BULLET =
  "NLP pipeline extracting symptoms, medications, and care events from free-text clinical notes; 0.90 F1.";
export const PIPELINE_BULLET =
  "Real-time feature pipeline on SignalR and SQL Server change tracking; nightly retraining on the day's transactions.";

export function base(): ResumeData {
  return {
    ...EMPTY_RESUME_DATA,
    basics: { name: "Sam Doe", headline: "Machine Learning Engineer" },
    summary:
      "Machine learning engineer who takes models from research question to production service. Trained in computer vision and multimodal learning, with published work in medical imaging, on top of nine years of building software that people depend on. Applied-math background.",
    experience: [
      {
        company: "EmTech",
        title: "Senior AI/ML Engineer",
        start: "Jan 2025",
        bullets: [NLP_BULLET],
      },
      {
        company: "AllFactors",
        title: "ML Engineer",
        start: "Oct 2021",
        bullets: [PIPELINE_BULLET],
      },
    ],
    projects: [],
    skills: [{ group: "Infra", items: ["Docker", "AWS", "HIPAA"] }],
    education: [],
  };
}
