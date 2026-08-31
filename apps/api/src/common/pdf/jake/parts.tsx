// biome-ignore-all lint/suspicious/noArrayIndexKey: react-pdf renders once to a buffer -- no
// reconciliation, and the mapped rows carry no stable id.

import { Children, type ReactElement, type ReactNode } from "react";
import type { ResumeBasics } from "@jobpilot/contracts/resume";
import { Link, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";

/** Returns a formatted date range string in form "Start – End", handling various edge cases. */
export function dateRange(start: string | undefined, end: string | undefined): string {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s && !e) return "";
  if (s && !e) return `${s} – Present`;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

export function absoluteHref(raw: string): string {
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

export function displayUrl(raw: string): string {
  return raw.replace(/^https?:\/\//, "");
}

/**
 * The shared entry skeleton: a bold title, an optional right-aligned date or venue, an optional
 * italic subline, then whatever the section adds under it.
 */
export function TitledEntry(props: {
  title: string;
  right?: ReactNode;
  sub?: string;
  /** Right-aligned partner for `sub`, such as an experience entry's location. */
  subRight?: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <View style={styles.entryBlock} wrap={false}>
      <View style={styles.entryHeaderRow}>
        <Text style={styles.entryTitle}>{props.title}</Text>
        {props.right}
      </View>
      {props.sub && (
        <View style={styles.entrySubRow}>
          <Text>{props.sub}</Text>
          {props.subRight && <Text>{props.subRight}</Text>}
        </View>
      )}
      {props.children}
    </View>
  );
}

/** The right-hand slot of a `TitledEntry` header, rendered only when there is something to show. */
export function EntryRight(props: { children?: string }): ReactNode {
  if (!props.children) return null;
  return <Text style={styles.entryRight}>{props.children}</Text>;
}

export function ContactBar(props: { basics: ResumeBasics }): ReactNode {
  const { basics } = props;
  const parts: { kind: "text" | "link"; value: string; href?: string }[] = [];

  if (basics.location) parts.push({ kind: "text", value: basics.location });
  if (basics.phone) parts.push({ kind: "text", value: basics.phone });
  if (basics.email) {
    parts.push({ kind: "link", value: basics.email, href: `mailto:${basics.email}` });
  }
  for (const url of [basics.linkedin, basics.github, basics.website]) {
    if (url) parts.push({ kind: "link", value: displayUrl(url), href: absoluteHref(url) });
  }

  if (parts.length === 0) return null;

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

export function Bullets(props: { items: string[] }): ReactNode {
  if (props.items.length === 0) return null;

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

/**
 * A resume section: an uppercase header followed by its content. The header is
 * grouped with the first child in a non-wrapping block so it never gets orphaned
 * at the bottom of a page when its first entry overflows to the next one.
 */
export function Section(props: { title: string; children: ReactNode }): ReactElement {
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
