import type { ReactElement, ReactNode } from "react";
import { Box, Container, Grid, Link, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { BrandMark } from "./brand-mark";
import { marketingLinkSx } from "./marketing-link-sx";

interface FooterColumnProps {
  title: string;
  children: ReactNode;
}

function FooterColumn(props: FooterColumnProps): ReactElement {
  const { title, children } = props;
  return (
    <Stack spacing={1.25}>
      <Typography variant="overlineMuted">{title}</Typography>
      {children}
    </Stack>
  );
}

interface InternalLinkProps {
  href: Route;
  label: string;
}

function InternalLink(props: InternalLinkProps): ReactElement {
  const { href, label } = props;
  return (
    <Link href={href} underline="none" sx={marketingLinkSx}>
      {label}
    </Link>
  );
}

interface ExternalFooterLinkProps {
  href: string;
  label: string;
}

function ExternalFooterLink(props: ExternalFooterLinkProps): ReactElement {
  const { href, label } = props;
  return (
    <Link href={href} underline="none" sx={marketingLinkSx}>
      {label}
    </Link>
  );
}

export function MarketingFooter(): ReactElement {
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: "line.divider" }}>
      <Container maxWidth="lg" sx={{ paddingBlock: 5 }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <BrandMark />
              <Typography variant="captionMuted">
                An AI agent that applies to jobs for you.
              </Typography>
              <Typography variant="monoCaption" color="textDisabled">
                © 2026 Sukhrob Ilyosbekov
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <FooterColumn title="Product">
              <InternalLink href="/jobs" label="Browse jobs" />
              <InternalLink href="/leaderboard" label="Leaderboard" />
              <InternalLink href="/docs" label="Docs" />
              <InternalLink href="/login" label="Sign in" />
              <InternalLink href="/register" label="Create account" />
            </FooterColumn>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <FooterColumn title="Resources">
              <ExternalFooterLink href="https://github.com/suxrobGM/jobpilot" label="GitHub" />
              <ExternalFooterLink
                href="https://github.com/suxrobGM/jobpilot/blob/main/CHANGELOG.md"
                label="Changelog"
              />
              <ExternalFooterLink
                href="https://github.com/suxrobGM/jobpilot/blob/main/docs/architecture.md"
                label="Architecture"
              />
            </FooterColumn>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
