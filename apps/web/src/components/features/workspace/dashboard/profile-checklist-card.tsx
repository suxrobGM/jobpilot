"use client";

import type { ReactElement } from "react";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { useApiQuery } from "@/api/hooks";
import { credentialQueries, emailQueries, profileQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useAuth } from "@/hooks/use-auth";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: Route;
  action: string;
}

/**
 * Post-onboarding nudges for everything the 3-step wizard skipped. Rendered on
 * the pipeline until every item is done, then disappears.
 */
export function ProfileChecklistCard(): ReactElement | null {
  const { user } = useAuth();
  const profileQuery = useApiQuery(profileQueries.detail());
  const emailQuery = useApiQuery(emailQueries.account());
  const credentialsQuery = useApiQuery(credentialQueries.list());

  // Don't flash an incomplete checklist while the queries load.
  if (!user || !profileQuery.data || !emailQuery.data || !credentialsQuery.data) {
    return null;
  }

  const profile = profileQuery.data.profile;
  const items: ChecklistItem[] = [
    {
      key: "verify-email",
      label: "Verify your email - unlocks applying and networking",
      done: user.emailVerified,
      href: "/verify-email" as Route,
      action: "Resend link",
    },
    {
      key: "address",
      label: "Add your address and work authorization - application forms need them",
      done: Boolean(profile?.street && profile.city),
      href: "/settings/profile" as Route,
      action: "Fill in",
    },
    {
      key: "mailbox",
      label: "Connect your mailbox - auto-fetch verification codes and recruiter replies",
      done: emailQuery.data.connected,
      href: "/settings/email" as Route,
      action: "Connect",
    },
    {
      key: "credentials",
      label: "Save job-board credentials - the agent logs in before applying",
      done: credentialsQuery.data.length > 0,
      href: "/settings/credentials" as Route,
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
          <Stack
            key={item.key}
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", minHeight: 36 }}
          >
            {item.done ? (
              <CheckCircle fontSize="small" sx={{ color: "success.main" }} />
            ) : (
              <RadioButtonUnchecked fontSize="small" sx={{ color: "text.disabled" }} />
            )}
            <Typography
              variant="body2"
              sx={{ flex: 1, color: item.done ? "text.disabled" : "text.primary" }}
            >
              {item.label}
            </Typography>
            {!item.done && (
              <LinkButton href={item.href} size="small" variant="outlined">
                {item.action}
              </LinkButton>
            )}
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
