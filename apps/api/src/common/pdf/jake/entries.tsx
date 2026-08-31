// biome-ignore-all lint/suspicious/noArrayIndexKey: react-pdf renders once to a buffer -- no
// reconciliation, and the mapped rows carry no stable id.

import type { ReactElement, ReactNode } from "react";
import type {
  ResumeAward,
  ResumeCertification,
  ResumeCustomEntry,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumePublication,
  ResumeSkillGroup,
} from "@jobpilot/contracts/resume";
import { Link, Text, View } from "@react-pdf/renderer";
import { absoluteHref, Bullets, dateRange, displayUrl, EntryRight, TitledEntry } from "./parts";
import { styles } from "./styles";

export function ExperienceEntry(props: { entry: ResumeExperience }): ReactElement {
  const { entry } = props;
  return (
    <TitledEntry
      title={entry.company}
      right={<EntryRight>{dateRange(entry.start, entry.end)}</EntryRight>}
      sub={entry.title}
      subRight={entry.location ?? undefined}
    >
      <Bullets items={entry.bullets} />
    </TitledEntry>
  );
}

/** Lowercased, whitespace-collapsed form for comparing two text fragments. */
function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function ProjectEntry(props: { entry: ResumeProject }): ReactElement {
  const { entry } = props;

  const keywordsLine = entry.keywords.join(", ");
  // Extraction sometimes lands the project's tech-stack line in both `keywords`
  // and `description`; only show the description when it adds something new.
  const showDescription =
    !!entry.description && normalizeText(entry.description) !== normalizeText(keywordsLine);

  return (
    <TitledEntry
      title={entry.name}
      right={
        <>
          {entry.url && (
            <Link
              src={absoluteHref(entry.url)}
              style={[styles.link, { flexShrink: 0, marginLeft: 8 }]}
            >
              {displayUrl(entry.url)}
            </Link>
          )}
          <EntryRight>{dateRange(entry.start, entry.end)}</EntryRight>
        </>
      }
    >
      {entry.keywords.length > 0 && <Text style={styles.projectKeywords}>{keywordsLine}</Text>}
      {showDescription && <Text style={styles.entryNote}>{entry.description}</Text>}
      <Bullets items={entry.bullets} />
    </TitledEntry>
  );
}

export function SkillsList(props: { groups: ResumeSkillGroup[] }): ReactNode {
  if (props.groups.length === 0) return null;
  return (
    <View style={{ marginTop: 4 }}>
      {props.groups.map((g, i) => (
        <View key={i} style={styles.skillRow}>
          <Text style={styles.skillGroup}>{g.group}:</Text>
          <Text style={styles.skillItems}>{g.items.join(", ")}</Text>
        </View>
      ))}
    </View>
  );
}

export function EducationEntry(props: { entry: ResumeEducation }): ReactElement {
  const { entry } = props;
  return (
    <TitledEntry
      title={entry.school}
      right={<EntryRight>{dateRange(entry.start, entry.end)}</EntryRight>}
      sub={entry.degree}
    >
      {entry.details.length > 0 && (
        <View style={styles.educationDetails}>
          {entry.details.map((d, i) => (
            <Text key={i}>{d}</Text>
          ))}
        </View>
      )}
    </TitledEntry>
  );
}

export function PublicationEntry(props: { entry: ResumePublication }): ReactElement {
  const { entry } = props;
  // A DOI is the citation's stable handle, so it wins over a URL that may rot.
  const link = entry.doi ? `https://doi.org/${entry.doi.replace(/^doi:\s*/i, "")}` : entry.url;

  return (
    <TitledEntry
      title={entry.title}
      right={<EntryRight>{entry.year}</EntryRight>}
      sub={entry.authors}
    >
      {entry.venue && <Text style={styles.entryNote}>{entry.venue}</Text>}
      {link && (
        <Link src={absoluteHref(link)} style={styles.link}>
          {entry.doi ?? displayUrl(link)}
        </Link>
      )}
    </TitledEntry>
  );
}

export function AwardEntry(props: { entry: ResumeAward }): ReactElement {
  const { entry } = props;
  return (
    <TitledEntry
      title={entry.title}
      right={<EntryRight>{entry.year}</EntryRight>}
      sub={entry.issuer}
    >
      {entry.description && <Text style={styles.entryNote}>{entry.description}</Text>}
    </TitledEntry>
  );
}

export function CertificationEntry(props: { entry: ResumeCertification }): ReactElement {
  const { entry } = props;
  return (
    <TitledEntry
      title={entry.name}
      right={<EntryRight>{dateRange(entry.issued ?? "", entry.expires)}</EntryRight>}
      sub={entry.issuer}
    >
      {entry.credentialId && <Text style={styles.entryNote}>{entry.credentialId}</Text>}
    </TitledEntry>
  );
}

export function CustomEntry(props: { entry: ResumeCustomEntry }): ReactElement {
  const { entry } = props;
  return (
    <TitledEntry
      title={entry.heading}
      right={<EntryRight>{entry.meta}</EntryRight>}
      sub={entry.subheading}
    >
      <Bullets items={entry.bullets} />
    </TitledEntry>
  );
}
