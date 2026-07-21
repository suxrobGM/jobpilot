import type { ReactElement, ReactNode } from "react";
import { ArrowBack } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { LinkButton } from "@/components/ui/buttons";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** When set, renders a back link above the eyebrow. */
  backHref?: Route;
  backLabel?: string;
}

export function PageHeader(props: PageHeaderProps): ReactElement {
  const { eyebrow, title, description, actions, backHref, backLabel = "Back" } = props;
  return (
    <Stack sx={{ mb: 3 }}>
      {backHref && (
        <LinkButton
          href={backHref}
          size="small"
          variant="text"
          startIcon={<ArrowBack fontSize="sm" />}
          sx={{ alignSelf: "flex-start", ml: -1, mb: 0.5 }}
        >
          {backLabel ?? "Back"}
        </LinkButton>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1.5, sm: 0 }}
        sx={{
          alignItems: { xs: "stretch", sm: "flex-end" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          {eyebrow && <Typography variant="overlineMuted">{eyebrow}</Typography>}
          <Typography variant="h2" component="h1" sx={{ mt: eyebrow ? 0.5 : 0 }}>
            {title}
          </Typography>
          {description &&
            (typeof description === "string" ? (
              <Typography variant="body1Muted" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            ) : (
              <Box sx={{ mt: 0.5 }}>{description}</Box>
            ))}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
