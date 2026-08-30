import type { ReactElement, ReactNode } from "react";
import { Description, Mail, Person, PictureAsPdf } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { resumePdfUrl, variantPdfUrl } from "@/api/resume-urls";
import type { ApplicationDetailDto } from "@/api/types";
import { EmptyState } from "@/components/ui/data";
import { ExternalLink, ItemList, ItemRow, RelativeTime } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";

interface SubmissionDetailsProps {
  application: ApplicationDetailDto;
}

/** What went out with the application, and what came back. */
export function SubmissionDetails(props: SubmissionDetailsProps): ReactElement {
  const { application: app } = props;

  return (
    <>
      <DocumentsCard application={app} />
      <JobDescriptionCard application={app} />
      <CorrespondenceCard application={app} />
    </>
  );
}

/**
 * The resume that went out, tailored or not. Tailoring reuses an existing variant far more often
 * than it creates one, so `resumeVariants` is empty for most applications and the base is all there
 * is to show.
 */
function submittedResumeRow(app: ApplicationDetailDto): ReactNode {
  const used = app.resumeVariantUsed;
  const base = app.resume;

  if (used) {
    return (
      <ItemRow
        key={used.id}
        icon={<Description fontSize="sm" />}
        primary={<Link href={`/resumes/${used.resumeId}`}>{used.label}</Link>}
        secondary={used.diffNotes ?? "Tailored for this job."}
        action={<ExternalLink href={variantPdfUrl(used.id, used.updatedAt)}>PDF</ExternalLink>}
      />
    );
  }
  if (base) {
    return (
      <ItemRow
        key={base.id}
        icon={<Description fontSize="sm" />}
        primary={<Link href={`/resumes/${base.id}`}>{base.label}</Link>}
        secondary="Sent as-is, not tailored for this job."
        action={<ExternalLink href={resumePdfUrl(base.id, base.updatedAt)}>PDF</ExternalLink>}
      />
    );
  }
  return null;
}

function DocumentsCard(props: SubmissionDetailsProps): ReactElement {
  const { application: app } = props;
  // Variants tailored for this job that were not the one submitted - a pre-submit draft, or a
  // second attempt. The submitted row above already covers the one that went out.
  const otherVariants = app.resumeVariants.filter((v) => v.id !== app.resumeVariantUsed?.id);

  const rows: ReactNode[] = [
    submittedResumeRow(app),
    ...otherVariants.map((v) => (
      <ItemRow
        key={v.id}
        icon={<Description fontSize="sm" />}
        primary={<Link href={`/resumes/${v.resumeId}`}>{v.label}</Link>}
        secondary={v.diffNotes ?? undefined}
        action={<RelativeTime value={v.createdAt} />}
      />
    )),
    ...app.coverLetters.map((c) => (
      <ItemRow
        key={c.id}
        icon={<PictureAsPdf fontSize="sm" />}
        primary={<Link href={`/cover-letters/${c.id}`}>Cover letter</Link>}
        action={<RelativeTime value={c.createdAt} />}
      />
    )),
  ].filter(Boolean);

  return (
    <SectionCard title="Documents" description="The resume and letter sent with this application.">
      {rows.length > 0 ? (
        <ItemList>{rows}</ItemList>
      ) : (
        <EmptyState variant="inline" title="No documents were recorded for this application." />
      )}
    </SectionCard>
  );
}

function JobDescriptionCard(props: SubmissionDetailsProps): ReactElement {
  const { application: app } = props;
  const job = app.job;

  return (
    <SectionCard title="Job description">
      {job?.description ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
            {job.salary && <Typography variant="body2Muted">{job.salary}</Typography>}
            {job.type && <Typography variant="body2Muted">{job.type}</Typography>}
          </Stack>
          <Accordion>
            <AccordionSummary>Read the posting</AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {job.description}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Stack>
      ) : (
        <EmptyState
          variant="inline"
          title="The posting text was not captured. Open the posting above for the live version."
        />
      )}
    </SectionCard>
  );
}

function CorrespondenceCard(props: SubmissionDetailsProps): ReactElement {
  const { application: app } = props;
  const rows: ReactNode[] = [
    ...app.emailMessages.map((m) => (
      <ItemRow
        key={m.id}
        icon={<Mail fontSize="sm" />}
        primary={<Link href="/inbox">{m.subject}</Link>}
        secondary={[m.fromName, m.classification].filter(Boolean).join(" · ")}
        action={<RelativeTime value={m.receivedAt} />}
      />
    )),
    ...app.contacts.map((c) => (
      <ItemRow
        key={c.id}
        icon={<Person fontSize="sm" />}
        primary={
          c.linkedinUrl ? <ExternalLink href={c.linkedinUrl}>{c.name}</ExternalLink> : c.name
        }
        secondary={[c.title, c.email].filter(Boolean).join(" · ")}
      />
    )),
  ];

  return (
    <SectionCard title="Correspondence" description="Matched mail and contacts at this company.">
      {rows.length > 0 ? (
        <ItemList>{rows}</ItemList>
      ) : (
        <EmptyState variant="inline" title="Nothing has come back yet." />
      )}
    </SectionCard>
  );
}
