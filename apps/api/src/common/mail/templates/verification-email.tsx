import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout } from "./layout";
import { body, button, fineprint, heading } from "./styles";

export const verificationEmailSubject = "Verify your email for JobPilot";

interface VerificationEmailProps {
  link: string;
}

export function VerificationEmail(props: VerificationEmailProps) {
  const { link } = props;
  return (
    <EmailLayout preview="Confirm your email address to start using JobPilot">
      <Heading as="h2" style={heading}>
        Confirm your email
      </Heading>
      <Text style={body}>
        Welcome to JobPilot! Confirm this is your email address to activate your account.
      </Text>
      <Button href={link} style={button}>
        Verify email
      </Button>
      <Text style={fineprint}>
        Or paste this link into your browser:
        <br />
        <Link href={link}>{link}</Link>
      </Text>
      <Text style={fineprint}>This link expires in 24 hours.</Text>
    </EmailLayout>
  );
}
