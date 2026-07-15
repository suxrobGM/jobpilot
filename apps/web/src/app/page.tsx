import type { ReactElement } from "react";
import { Box } from "@mui/material";
import type { Metadata } from "next";
import {
  BoardStrip,
  CampaignTypes,
  CtaBand,
  FAQ_ITEMS,
  Faq,
  Hero,
  HowItWorks,
  LiveJobsStrip,
  MarketingFooter,
  MarketingNav,
  Pilot,
  PrivacyGrid,
  ProductTour,
} from "@/components/features/marketing";
import { JsonLd } from "@/components/seo";
import { faqPageLd, organizationLd, softwareApplicationLd, websiteLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const SOFTWARE_DESCRIPTION =
  "JobPilot drives Claude Code or Codex on your own subscription to search any job board - 12 built in - tailor your resume, apply, and track every reply from one dashboard.";

export default function LandingPage(): ReactElement {
  return (
    // overflowX clip: decorative glows/orbs must never widen the page on mobile.
    <Box sx={{ minHeight: "100vh", backgroundColor: "surfaces.base", overflowX: "clip" }}>
      <JsonLd
        data={[
          organizationLd(),
          websiteLd(),
          softwareApplicationLd(SOFTWARE_DESCRIPTION),
          faqPageLd(FAQ_ITEMS),
        ]}
      />
      <MarketingNav />
      <Box component="main">
        <Hero />
        <Pilot />
        <BoardStrip />
        <CampaignTypes />

        <LiveJobsStrip />

        <ProductTour />
        <PrivacyGrid />
        <HowItWorks />
        <Faq />
        <CtaBand />
      </Box>
      <MarketingFooter />
    </Box>
  );
}
