import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

const main = {
  backgroundColor: "#f4f4f5",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const wordmark = { color: "#18181b", fontSize: "22px", fontWeight: 700, margin: 0 };
const divider = { borderColor: "#e4e4e7", margin: "20px 0" };
const footer = { color: "#71717a", fontSize: "12px", lineHeight: "18px", margin: 0 };

/** Shared branded wrapper for transactional emails. Inline styles are required — email clients strip stylesheets. */
export function EmailLayout(props: EmailLayoutProps) {
  const { preview, children } = props;
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>JobPilot</Text>
          <Hr style={divider} />
          {children}
          <Hr style={divider} />
          <Section>
            <Text style={footer}>
              If you didn&apos;t request this, you can safely ignore this email — no changes will be
              made to your account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
