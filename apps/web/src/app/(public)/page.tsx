import type { ReactElement } from "react";
import { Box } from "@mui/material";
import type { Metadata } from "next";
import {
  CtaBand,
  FAQ_ITEMS,
  Faq,
  Hero,
  LiveJobsStrip,
  Pilot,
  ProductTour,
  ProofStrip,
  Teaser,
  Trust,
} from "@/components/features/marketing";
import { JsonLd } from "@/components/seo/json-ld";
import {
  faqPageLd,
  organizationLd,
  softwareApplicationLd,
  websiteLd,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// The live strips are `use cache` so they prerender; a request-time read here would fail the build.
export const ensureStatic = "navigation";

const SOFTWARE_DESCRIPTION =
  "A free, open-source AI agent that finds jobs, tailors your resume, and applies for you. It runs on your computer with your Claude Code or Codex subscription.";

export default function LandingPage(): ReactElement {
  return (
    <>
      <JsonLd
        data={[
          organizationLd(),
          websiteLd(),
          softwareApplicationLd(SOFTWARE_DESCRIPTION),
          faqPageLd(FAQ_ITEMS),
        ]}
      />
      <Box component="main">
        <Hero />
        <Teaser footer={<ProofStrip />} />
        <Pilot />
        <ProductTour />
        <Trust />
        <LiveJobsStrip />
        <Faq />
        <CtaBand />
      </Box>
    </>
  );
}
