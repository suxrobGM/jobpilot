"use client";

import type { ReactNode } from "react";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { credentialQueries, emailQueries, userQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { ChecklistRow } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { useSession } from "@/hooks/use-auth";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: Route;
  action: string;
}

/** Nudges for everything the onboarding wizard skipped, until every item is done. */
export function ProfileChecklistCard(): ReactNode {
  const { user } = useSession();
  const profileQuery = useQuery(userQueries.detail());
  const emailQuery = useQuery(emailQueries.account());
  const credentialsQuery = useQuery(credentialQueries.list());

  // Don't flash an incomplete checklist while the queries load.
  if (!user || !profileQuery.data || !emailQuery.data || !credentialsQuery.data) {
    return null;
  }

  const profile = profileQuery.data.user;
  const mailbox = emailQuery.data;
  const needsReauth = mailbox.connected && mailbox.needsReauth;
  const items: ChecklistItem[] = [
    {
      key: "verify-email",
      label: "Verify your email so you can apply and send messages.",
      done: user.emailVerified,
      href: "/verify-email",
      action: "Resend link",
    },
    {
      key: "address",
      label: "Add your address and work authorization. Application forms ask for both.",
      done: Boolean(profile?.street && profile.city),
      href: "/settings/profile",
      action: "Fill in",
    },
    {
      key: "mailbox",
      label: needsReauth
        ? "Reconnect your mailbox - Google rejected its access grant, so mail sync has stopped."
        : "Connect your mailbox so the agent can read verification codes and recruiter replies.",
      done: mailbox.connected && !needsReauth,
      href: "/settings/email",
      action: needsReauth ? "Reconnect" : "Connect",
    },
    {
      key: "credentials",
      label: "Save your job-board logins so the agent can sign in before it applies.",
      done: credentialsQuery.data.length > 0,
      href: "/settings/credentials",
      action: "Add",
    },
  ];

  const remaining = items.filter((item) => !item.done);
  if (remaining.length === 0) {
    return null;
  }

  return (
    <SectionCard title={`Finish setting up · ${items.length - remaining.length}/${items.length}`}>
      <Stack spacing={1}>
        {items.map((item) => (
          <ChecklistRow
            key={item.key}
            done={item.done}
            label={item.label}
            action={
              <LinkButton href={item.href} size="small" variant="outlined">
                {item.action}
              </LinkButton>
            }
          />
        ))}
      </Stack>
    </SectionCard>
  );
}
