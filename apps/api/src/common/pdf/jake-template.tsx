// biome-ignore-all lint/suspicious/noArrayIndexKey: react-pdf renders once to a buffer -- no
// reconciliation, and the mapped rows carry no stable id.

import { Children, type ReactElement, type ReactNode } from "react";
import type {
  ResumeBasics,
  ResumeData,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumeSkillGroup,
} from "@jobpilot/contracts/resume";
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111",
    lineHeight: 1.35,
  },
  name: {
    fontSize: 22,
    lineHeight: 1.2,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headline: {
    fontSize: 12,
    textAlign: "center",
    color: "#444",
    marginTop: 3,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 8,
    fontSize: 9.5,
    color: "#222",
  },
  contactItem: { marginHorizontal: 4 },
  contactSep: { marginHorizontal: 2, color: "#888" },
  link: { color: "#1f4ea8", textDecoration: "none" },
  sectionHeader: {
    marginTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: "#000",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summary: { marginTop: 6, textAlign: "justify" },
  entryBlock: { marginTop: 6 },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  entryRight: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  entrySubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontStyle: "italic",
    marginTop: 1,
    fontSize: 9.5,
  },
  bulletList: { marginTop: 3, paddingLeft: 10 },
  bulletRow: { flexDirection: "row", marginTop: 1.5 },
  bulletDot: { width: 8, fontSize: 10 },
  bulletText: { flex: 1, textAlign: "justify" },
  skillRow: { flexDirection: "row", marginTop: 2 },
  skillGroup: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  skillItems: { flex: 1 },
  projectDescription: { marginTop: 2, fontStyle: "italic" },
  projectKeywords: { marginTop: 1, fontSize: 9.5, color: "#333" },
  educationDetails: { marginTop: 2 },
});

/** Returns a formatted date range string in form "Start – End", handling various edge cases. */
function dateRange(start: string | undefined, end: string | undefined): string {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return "";
  if (s && !e) return `${s} – Present`;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

function ContactBar(props: { basics: ResumeBasics }): ReactNode {
  const { basics } = props;
  const parts: { kind: "text" | "link"; value: string; href?: string }[] = [];

  if (basics.location) {
    parts.push({ kind: "text", value: basics.location });
  }
  if (basics.phone) {
    parts.push({ kind: "text", value: basics.phone });
  }
  if (basics.email) {
    parts.push({ kind: "link", value: basics.email, href: `mailto:${basics.email}` });
  }
  if (basics.linkedin) {
    const href = basics.linkedin.startsWith("http")
      ? basics.linkedin
      : `https://${basics.linkedin}`;
    parts.push({ kind: "link", value: basics.linkedin.replace(/^https?:\/\//, ""), href });
  }

  if (basics.github) {
    const href = basics.github.startsWith("http") ? basics.github : `https://${basics.github}`;
    parts.push({ kind: "link", value: basics.github.replace(/^https?:\/\//, ""), href });
  }

  if (basics.website) {
    const href = basics.website.startsWith("http") ? basics.website : `https://${basics.website}`;
    parts.push({ kind: "link", value: basics.website.replace(/^https?:\/\//, ""), href });
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <View style={styles.contactRow}>
      {parts.map((p, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {i > 0 && <Text style={styles.contactSep}>|</Text>}
          {p.kind === "link" ? (
            <Link src={p.href ?? ""} style={[styles.contactItem, styles.link]}>
              {p.value}
            </Link>
          ) : (
            <Text style={styles.contactItem}>{p.value}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Bullets(props: { items: string[] }): ReactNode {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.bulletList}>
      {props.items.map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function ExperienceEntry(props: { entry: ResumeExperience }): ReactElement {
  const { entry } = props;
  return (
    <View style={styles.entryBlock} wrap={false}>
      <View style={styles.entryHeaderRow}>
        <Text style={styles.entryTitle}>{entry.company}</Text>
        <Text style={styles.entryRight}>{dateRange(entry.start, entry.end)}</Text>
      </View>
      <View style={styles.entrySubRow}>
        <Text>{entry.title}</Text>
        {entry.location ? <Text>{entry.location}</Text> : <Text> </Text>}
      </View>
      <Bullets items={entry.bullets} />
    </View>
  );
}

/** Lowercased, whitespace-collapsed form for comparing two text fragments. */
function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function ProjectEntry(props: { entry: ResumeProject }): ReactElement {
  const { entry } = props;

  const keywordsLine = entry.keywords.join(", ");
  // Extraction sometimes lands the project's tech-stack line in both `keywords`
  // and `description`; only show the description when it adds something new.
  const showDescription =
    !!entry.description && normalizeText(entry.description) !== normalizeText(keywordsLine);

  return (
    <View style={styles.entryBlock} wrap={false}>
      <View style={styles.entryHeaderRow}>
        <Text style={[styles.entryTitle, { flex: 1 }]}>{entry.name}</Text>
        {entry.url && (
          <Link
            src={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
            style={[styles.link, { flexShrink: 0, marginLeft: 8 }]}
          >
            {entry.url.replace(/^https?:\/\//, "")}
          </Link>
        )}
      </View>
      {entry.keywords.length > 0 && <Text style={styles.projectKeywords}>{keywordsLine}</Text>}
      {showDescription && <Text style={styles.projectDescription}>{entry.description}</Text>}
      <Bullets items={entry.bullets} />
    </View>
  );
}

function SkillsList(props: { groups: ResumeSkillGroup[] }): ReactNode {
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

function EducationEntry(props: { entry: ResumeEducation }): ReactElement {
  const { entry } = props;
  return (
    <View style={styles.entryBlock} wrap={false}>
      <View style={styles.entryHeaderRow}>
        <Text style={styles.entryTitle}>{entry.school}</Text>
        <Text style={styles.entryRight}>{dateRange(entry.start, entry.end)}</Text>
      </View>
      <View style={styles.entrySubRow}>
        <Text>{entry.degree}</Text>
      </View>
      {entry.details.length > 0 && (
        <View style={styles.educationDetails}>
          {entry.details.map((d, i) => (
            <Text key={i}>{d}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * A resume section: an uppercase header followed by its content. The header is
 * grouped with the first child in a non-wrapping block so it never gets orphaned
 * at the bottom of a page when its first entry overflows to the next one.
 */
function Section(props: { title: string; children: ReactNode }): ReactElement {
  const [first, ...rest] = Children.toArray(props.children);
  return (
    <>
      <View wrap={false}>
        <Text style={styles.sectionHeader}>{props.title}</Text>
        {first}
      </View>
      {rest}
    </>
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
        {data.basics.headline && data.basics.headline.trim().length > 0 && (
          <Text style={styles.headline}>{data.basics.headline}</Text>
        )}
        <ContactBar basics={data.basics} />

        {data.summary && data.summary.trim().length > 0 && (
          <Section title="Summary">
            <Text style={styles.summary}>{data.summary}</Text>
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="Technical Skills">
            <SkillsList groups={data.skills} />
          </Section>
        )}

        {data.education.length > 0 && (
          <Section title="Education">
            {data.education.map((e, i) => (
              <EducationEntry key={i} entry={e} />
            ))}
          </Section>
        )}

        {data.experience.length > 0 && (
          <Section title="Experience">
            {data.experience.map((e, i) => (
              <ExperienceEntry key={i} entry={e} />
            ))}
          </Section>
        )}

        {data.projects.length > 0 && (
          <Section title="Projects">
            {data.projects.map((p, i) => (
              <ProjectEntry key={i} entry={p} />
            ))}
          </Section>
        )}
      </Page>
    </Document>
  );
}
