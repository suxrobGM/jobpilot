import { ImageResponse } from "next/og";
import { api } from "@/api/client";
import { getPublicFetchOptions } from "@/api/server";
import { OG_SIZE, OgFrame } from "@/components/seo/og-frame";
import { SITE_HOST } from "@/lib/constants";
import { accent, textColors } from "@/theme/palette";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "JobPilot portfolio";

interface OgProps {
  params: Promise<{ username: string }>;
}

export default async function PortfolioOgImage(props: OgProps): Promise<ImageResponse> {
  const { username } = await props.params;

  // Resolved outside the try: a bailout signal from `headers()` must not be swallowed as a down API.
  const options = await getPublicFetchOptions();

  // A down API must yield the generic card, never a 500 that breaks the link unfurl.
  let name = "JobPilot portfolio";
  let headline: string | null = null;
  let applications: number | null = null;
  try {
    const { data } = await api.public.portfolios({ username }).get(options);
    if (data) {
      name = data.displayName;
      headline = data.headline;
      applications = data.stats.applications;
    }
  } catch {
    // fall through to the generic card
  }

  return new ImageResponse(
    <OgFrame
      markSize={56}
      footer={
        <>
          <div style={{ display: "flex" }}>
            {SITE_HOST}/u/{username}
          </div>
          {applications !== null && (
            <div style={{ display: "flex", color: accent.primary }}>
              {applications} applications tracked
            </div>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            color: textColors.primary,
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          {name}
        </div>
        {headline && (
          <div
            style={{ color: textColors.secondary, fontSize: 38, lineHeight: 1.3, maxWidth: 940 }}
          >
            {headline}
          </div>
        )}
      </div>
    </OgFrame>,
    { ...size },
  );
}
