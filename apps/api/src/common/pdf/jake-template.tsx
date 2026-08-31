// biome-ignore-all lint/suspicious/noArrayIndexKey: react-pdf renders once to a buffer -- no
// reconciliation, and the mapped rows carry no stable id.

import type { ReactElement, ReactNode } from "react";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { Document, Page, Text } from "@react-pdf/renderer";
import {
  AwardEntry,
  CertificationEntry,
  CustomEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  PublicationEntry,
  SkillsList,
} from "./jake/entries";
import { ContactBar, Section } from "./jake/parts";
import { styles } from "./jake/styles";

/** A section that disappears when its list is empty, which is every section but Summary. */
function ListSection<T>(props: {
  title: string;
  items: T[];
  Entry: (p: { entry: T }) => ReactElement;
}): ReactNode {
  const { Entry } = props;
  if (props.items.length === 0) return null;
  return (
    <Section title={props.title}>
      {props.items.map((entry, i) => (
        <Entry key={i} entry={entry} />
      ))}
    </Section>
  );
}

interface JakeTemplateProps {
  data: ResumeData;
}

export function JakeTemplate(props: JakeTemplateProps): ReactElement {
  const { data } = props;
  return (
    <Document title={data.basics.name || "Resume"}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{data.basics.name || " "}</Text>
        {data.basics.headline?.trim() && (
          <Text style={styles.headline}>{data.basics.headline}</Text>
        )}
        <ContactBar basics={data.basics} />

        {data.summary?.trim() && (
          <Section title="Summary">
            <Text style={styles.summary}>{data.summary}</Text>
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="Technical Skills">
            <SkillsList groups={data.skills} />
          </Section>
        )}

        <ListSection title="Education" items={data.education} Entry={EducationEntry} />

        {/* Directly under Education: on an academic CV this is the section that carries the weight. */}
        <ListSection title="Publications" items={data.publications} Entry={PublicationEntry} />

        <ListSection title="Experience" items={data.experience} Entry={ExperienceEntry} />

        <ListSection title="Projects" items={data.projects} Entry={ProjectEntry} />

        <ListSection title="Awards & Honors" items={data.awards} Entry={AwardEntry} />

        <ListSection
          title="Certifications"
          items={data.certifications}
          Entry={CertificationEntry}
        />

        {/* Whatever the CV had that nothing above models - grants, talks, teaching, service. */}
        {data.sections.map((section, i) => (
          <ListSection key={i} title={section.title} items={section.entries} Entry={CustomEntry} />
        ))}
      </Page>
    </Document>
  );
}
