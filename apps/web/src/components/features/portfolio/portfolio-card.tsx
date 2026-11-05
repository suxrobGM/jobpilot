import type { ReactElement, ReactNode } from "react";
import { Download, GitHub, LanguageOutlined, LinkedIn } from "@mui/icons-material";
import { Button, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import type { PortfolioDto } from "@/api/types";
import { AvailabilityBadge } from "./availability-badge";
import { PortfolioAvatar } from "./portfolio-avatar";

interface PortfolioCardProps {
  portfolio: PortfolioDto;
}

/** A long resume lists more skills than a hero should carry; the rest collapse into a count. */
const MAX_SKILLS = 24;

/** Presentational identity header - shared by the public page and the settings live preview. */
export function PortfolioCard(props: PortfolioCardProps): ReactElement {
  const { portfolio } = props;
  const skills = portfolio.skills.slice(0, MAX_SKILLS);
  const overflow = portfolio.skills.length - skills.length;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2.5}
        sx={{ alignItems: { sm: "center" } }}
      >
        <PortfolioAvatar name={portfolio.displayName} size={80} />
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="displayMd" component="h1">
              {portfolio.displayName}
            </Typography>
            <AvailabilityBadge availability={portfolio.availability} />
          </Stack>
          {portfolio.headline && (
            <Typography variant="h4" component="h2" sx={{ color: "text.secondary" }}>
              {portfolio.headline}
            </Typography>
          )}
          {portfolio.location && <Typography variant="body2Muted">{portfolio.location}</Typography>}
        </Stack>
      </Stack>

      <PortfolioLinks portfolio={portfolio} />

      {portfolio.summary && (
        <Typography variant="body1Muted" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {portfolio.summary}
        </Typography>
      )}

      {skills.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {skills.map((skill) => (
            <Chip key={skill} label={skill} variant="outlined" />
          ))}
          {overflow > 0 && <Chip label={`+${overflow} more`} />}
        </Stack>
      )}
    </Stack>
  );
}

function PortfolioLinks(props: PortfolioCardProps): ReactNode {
  const { links, primaryResumeId } = props.portfolio;
  const icons = [
    { key: "website", href: links.website, title: "Website", icon: <LanguageOutlined /> },
    { key: "linkedin", href: links.linkedin, title: "LinkedIn", icon: <LinkedIn /> },
    { key: "github", href: links.github, title: "GitHub", icon: <GitHub /> },
  ].filter((link) => Boolean(link.href));

  if (!primaryResumeId && icons.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
      {primaryResumeId && (
        <Button
          href={`${API_BASE_URL}/api/public/resumes/${primaryResumeId}/pdf`}
          variant="contained"
          startIcon={<Download />}
        >
          Download resume
        </Button>
      )}
      {icons.map((link) => (
        <Tooltip key={link.key} title={link.title}>
          <IconButton href={link.href ?? ""} aria-label={link.title}>
            {link.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
