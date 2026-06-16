import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout } from "./layout";
import { body, button, fineprint, heading } from "./styles";

export const passwordResetEmailSubject = "Reset your JobPilot password";

interface PasswordResetEmailProps {
  link: string;
}

export function PasswordResetEmail(props: PasswordResetEmailProps) {
  const { link } = props;
  return (
    <EmailLayout preview="Reset your JobPilot password">
      <Heading as="h2" style={heading}>
        Reset your password
      </Heading>
      <Text style={body}>
        We received a request to reset your JobPilot password. Click the button below to choose a
        new one.
      </Text>
      <Button href={link} style={button}>
        Reset password
      </Button>
      <Text style={fineprint}>
        Or paste this link into your browser:
        <br />
        <Link href={link}>{link}</Link>
      </Text>
      <Text style={fineprint}>This link expires in 1 hour.</Text>
    </EmailLayout>
  );
}
