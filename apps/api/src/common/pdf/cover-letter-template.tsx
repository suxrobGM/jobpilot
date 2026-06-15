import type { ReactElement } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 64,
    paddingRight: 64,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#111",
    lineHeight: 1.5,
  },
  blank: { height: 8 },
});

interface CoverLetterTemplateProps {
  text: string;
}

/**
 * Renders the `cover-letter` skill's plain-text output to a one-page PDF,
 * preserving its line breaks and paragraph spacing (blank lines become gaps).
 */
export function CoverLetterTemplate(props: CoverLetterTemplateProps): ReactElement {
  const lines = props.text.replace(/\r\n/g, "\n").split("\n");
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {lines.map((line, i) =>
          line.trim() === "" ? <View key={i} style={styles.blank} /> : <Text key={i}>{line}</Text>,
        )}
      </Page>
    </Document>
  );
}
