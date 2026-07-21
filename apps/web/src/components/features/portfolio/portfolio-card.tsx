import type { ReactElement } from "react";
import { Download, GitHub, LanguageOutlined, LinkedIn } from "@mui/icons-material";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import type { PortfolioDto } from "@/api/types";
import { AvailabilityBadge } from "./availability-badge";
import { PortfolioAvatar } from "./portfolio-avatar";

interface PortfolioCardProps {
  portfolio: PortfolioDto;
}

/** Presentational identity header - shared by the public page and the settings live preview. */
export function PortfolioCard(props: PortfolioCardProps): ReactElement {
  const { portfolio } = props;
  const { links } = portfolio;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" } }}
      >
        <PortfolioAvatar name={portfolio.displayName} size={64} />
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.6rem", md: "2rem" } }}>
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

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {portfolio.primaryResumeId && (
          <Button
            component="a"
            href={`${API_BASE_URL}/api/public/resumes/${portfolio.primaryResumeId}/pdf`}
            target="_blank"
            rel="noopener"
            variant="contained"
            startIcon={<Download />}
          >
            Download resume
          </Button>
        )}
        {links.website && (
          <Button
            component="a"
            href={links.website}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<LanguageOutlined />}
          >
            Website
          </Button>
        )}
        {links.linkedin && (
          <Button
            component="a"
            href={links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<LinkedIn />}
          >
            LinkedIn
          </Button>
        )}
        {links.github && (
          <Button
            component="a"
            href={links.github}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<GitHub />}
          >
            GitHub
          </Button>
        )}
      </Stack>

      {portfolio.summary && (
        <Typography variant="body1Muted" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {portfolio.summary}
        </Typography>
      )}

      {portfolio.skills.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {portfolio.skills.map((skill) => (
            <Chip key={skill} label={skill} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
